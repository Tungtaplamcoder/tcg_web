const prisma = require('../../config/prisma');
const { NotFoundError, ConflictError, AppError } = require('../../utils/errors');
const gachaService = require('../../services/gacha.service');

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

// GET /api/v1/virtual-boxes — public list of ACTIVE boxes for the storefront
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
          _count: { select: { poolItems: true } }
        }
      }),
      prisma.virtualBox.count({ where })
    ]);

    const items = boxes.map(({ dropRates, _count, ...box }) => ({
      ...box,
      dropRates,
      cardPoolCount: _count.poolItems
    }));

    res.status(200).json({
      success: true,
      data: { items, meta: { page: Number(page), limit: take, totalItems, totalPages: Math.ceil(totalItems / take) } },
      message: 'Virtual boxes retrieved'
    });
  } catch (error) { next(error); }
};

// POST /api/v1/virtual-boxes/:id/open — authenticated gacha opening
// Gacha is 100% free: no balance is charged. The endpoint rolls the weighted
// RNG, grants the pulled card to the user's collection and records the opening.
// Rolls back entirely on any failure.
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
            product: {
              select: {
                id: true,
                name: true,
                shortName: true,
                slug: true,
                cardNumber: true,
                rarity: true,
                images: true,
                backImage: true
              }
            }
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
          productId: poolItem.productId,
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
          product: poolItem.product
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
  } catch (error) { next(error); }
};

module.exports = {
  listVirtualBoxes,
  openVirtualBox
};
