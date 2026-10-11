const prisma = require('../../config/prisma');
const { NotFoundError, ConflictError, AppError } = require('../../utils/errors');
const gachaService = require('../../services/gacha.service');
const { isDatabaseError, emptyPage, sendDbEmpty, sendDbError } = require('../../utils/dbGuard');

const BOX_SELECT_FIELDS = {
  id: true,
  name: true,
  slug: true,
  description: true,
  imageUrl: true,
  gradient: true,
  price: true,
  status: true,
  createdAt: true,
  updatedAt: true
};

const POOL_CARD_FIELDS = {
  id: true,
  name: true,
  slug: true,
  imageUrl: true,
  rarity: true,
  setCode: true,
  dropRate: true
};

// GET /api/v1/virtual-boxes — public list of ACTIVE boxes for the storefront.
// Boxes embed their GachaCard pool so the storefront renders real card
// artwork, set codes and names straight from the gacha data source.
const listVirtualBoxes = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const where = { status: 'ACTIVE' };
    const [boxes, totalItems] = await Promise.all([
      prisma.virtualBox.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'asc' },
        select: {
          ...BOX_SELECT_FIELDS,
          dropRates: { select: { rarity: true, rate: true } },
          poolItems: {
            select: { rarity: true, gachaCard: { select: POOL_CARD_FIELDS } }
          }
        }
      }),
      prisma.virtualBox.count({ where })
    ]);

    const items = boxes.map(({ dropRates, poolItems, ...box }) => ({
      ...box,
      dropRates,
      cardPoolCount: poolItems.length,
      cards: poolItems.map((item) => item.gachaCard)
    }));

    res.status(200).json({
      success: true,
      data: { items, meta: { page: Number(page), limit: take, totalItems, totalPages: Math.ceil(totalItems / take) } },
      message: 'Virtual boxes retrieved'
    });
  } catch (error) {
    // DB failure on a public storefront list: degrade to an empty page so
    // the VirtualBoxes page renders its empty state instead of erroring.
    if (isDatabaseError(error)) {
      return sendDbEmpty(res, 'gacha.listVirtualBoxes', error, emptyPage(Number(req.query?.page) || 1, Number(req.query?.limit) || 20));
    }
    next(error);
  }
};

// GET /api/v1/virtual-boxes/:id — public single-box detail for the storefront
// detail/opening page. Same shape as a list item (dropRates + embedded card
// pool) so the listing and the detail page share one box model. Accepts the
// UUID or the slug so deep links stay readable.
const getVirtualBoxById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const box = await prisma.virtualBox.findFirst({
      where: { status: 'ACTIVE', OR: [{ id }, { slug: id }] },
      select: {
        ...BOX_SELECT_FIELDS,
        dropRates: { select: { rarity: true, rate: true } },
        poolItems: {
          select: { rarity: true, gachaCard: { select: POOL_CARD_FIELDS } }
        }
      }
    });

    if (!box) throw new NotFoundError('Virtual box not found');

    // Real-time view counter — fire-and-forget; never blocks the response.
    prisma.virtualBox
      .update({ where: { id: box.id }, data: { viewCount: { increment: 1 } } })
      .catch(() => {});

    const { dropRates, poolItems, ...rest } = box;
    res.status(200).json({
      success: true,
      data: {
        ...rest,
        dropRates,
        cardPoolCount: poolItems.length,
        cards: poolItems.map((item) => item.gachaCard)
      },
      message: 'Virtual box retrieved'
    });
  } catch (error) {
    if (isDatabaseError(error)) {
      return sendDbError(res, 'gacha.getVirtualBoxById', error);
    }
    next(error);
  }
};

// POST /api/v1/virtual-boxes/:id/open — authenticated gacha opening.
// Gacha is 100% free: no balance is charged. The endpoint rolls the weighted
// RNG over the box's GachaCard pool, grants the pulled card to the user's
// collection and records the opening. Rolls back entirely on any failure.
const openVirtualBox = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const box = await prisma.virtualBox.findUnique({
      where: { id },
      include: {
        dropRates: { select: { rarity: true, rate: true } },
        poolItems: {
          include: {
            gachaCard: { select: POOL_CARD_FIELDS }
          }
        }
      }
    });

    if (!box) throw new NotFoundError('Virtual box not found');
    if (box.status !== 'ACTIVE') {
      throw new ConflictError('This box is not available for opening right now');
    }

    // Roll the weighted RNG
    const { rarity, poolItem } = gachaService.rollCardFromBox(box);

    const buyer = await prisma.user.findUnique({ where: { id: userId }, select: { balance: true, status: true } });
    if (!buyer || buyer.status !== 'ACTIVE') throw new AppError('Account is not active', 403, 'ACCOUNT_INACTIVE');

    const { userCard, opening, balance } = await prisma.$transaction(async (tx) => {
      const createdCard = await tx.userCard.create({
        data: {
          userId,
          gachaCardId: poolItem.gachaCardId,
          rarity,
          source: 'GACHA'
        }
      });

      const createdOpening = await tx.virtualBoxOpening.create({
        data: {
          userId,
          boxId: box.id,
          userCardId: createdCard.id,
          rarity,
          pricePaid: 0
        }
      });

      await tx.userCard.update({
        where: { id: createdCard.id },
        data: { openingId: createdOpening.id }
      });

      const updatedUser = await tx.user.findUnique({ where: { id: userId }, select: { balance: true } });

      return { userCard: createdCard, opening: createdOpening, balance: updatedUser.balance };
    });

    res.status(200).json({
      success: true,
      data: {
        card: {
          id: userCard.id,
          rarity,
          source: userCard.source,
          obtainedAt: userCard.obtainedAt,
          gachaCard: poolItem.gachaCard
        },
        opening: {
          id: opening.id,
          boxId: box.id,
          boxName: box.name,
          pricePaid: opening.pricePaid,
          createdAt: opening.createdAt
        },
        balance
      },
      message: 'Box opened successfully'
    });
  } catch (error) {
    // Write path (transactional card grant): a raw DB failure must not 500 —
    // the transaction rolls back, so a clean 400 tells the user to retry.
    if (isDatabaseError(error)) {
      return sendDbError(res, 'gacha.openVirtualBox', error);
    }
    next(error);
  }
};

module.exports = {
  listVirtualBoxes,
  getVirtualBoxById,
  openVirtualBox
};
