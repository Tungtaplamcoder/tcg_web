import React from 'react';
import { Zap, BookOpen } from 'lucide-react';
import { EnergyCostRow } from './EnergyBadge';

/**
 * AttackCard — one structured attack / ability container.
 * Cost tokens render as energy icon badges; the damage value sits in
 * its own accent chip; the rule text is typographically separated.
 */
const AttackCard = ({ attack, kind = 'attack' }) => {
  const isAbility = kind === 'ability' || !attack.costTokens.length && !attack.damage;
  const Icon = isAbility ? BookOpen : Zap;

  return (
    <div className="pd-attack-card group">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className={`pd-attack-icon ${isAbility ? 'pd-attack-icon--ability' : ''}`}>
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
          <h4 className="pd-attack-name">{attack.name}</h4>
        </div>
        {attack.damage && (
          <span className="pd-attack-damage shrink-0">
            {attack.damage}
          </span>
        )}
      </div>

      <div className="mt-3 flex items-center gap-3 flex-wrap">
        {attack.costTokens.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="pd-attack-cost-label">Cost</span>
            <EnergyCostRow tokens={attack.costTokens} size="sm" />
          </div>
        )}
        {attack.costLabel && !attack.costTokens.length && (
          <span className="pd-attack-cost-label pd-attack-cost-plain">{attack.costLabel}</span>
        )}
      </div>

      {attack.text && <p className="pd-attack-text">{attack.text}</p>}
    </div>
  );
};

export default AttackCard;
