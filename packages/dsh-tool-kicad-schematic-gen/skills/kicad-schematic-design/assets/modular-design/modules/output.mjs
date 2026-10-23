/** Use a frozen role reference; the child never allocates shared designators. */
export function place({ region, parts, references, nets, bounds }) {
  const reference = references.resistor;
  const { pins, ...symbol } = parts.resistor;
  region.addSymbol({ ...symbol, reference, value: '10k', at: region.snap([40, 35]) });
  return {
    bounds,
    localConnections: [],
    ports: { signal: { reference, pin: pins.top } },
    connect() {
      const bottom = region.pin(reference, pins.bottom);
      const ground = [bottom[0], bottom[1] + 7.62];
      region.wire(bottom, ground);
      region.label(nets.ground, ground);
    },
  };
}
