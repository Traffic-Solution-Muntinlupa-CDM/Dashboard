import { APPROACHES } from './controllerContract';

/**
 * Schematic fallback for the Overview camera panel and the live diagram on
 * Signal operations. It is not a camera view and never claims to be one.
 */
export default function MiniIntersection({ phase, caption }) {
  return (
    <figure className="intersection" aria-label={`Schematic intersection with ${phase} active`}>
      <div className="map-grid" />
      <div className="north-marker"><span>N</span><i /></div>
      <div className="road vertical"><span>NORTH / SOUTH</span></div>
      <div className="road horizontal"><span>BRUDGER — CITY HALL</span></div>
      <div className="center" />
      {APPROACHES.map((approach, index) => (
        <span key={approach.name} className={`light light-${index} ${approach.name === phase ? 'active' : ''}`}>
          <i />
          <b>{approach.name}</b>
        </span>
      ))}
      <figcaption>Source <span>{caption}</span></figcaption>
    </figure>
  );
}
