// specs/001 §7.1, §5.1 (piggyback) — minimal additive seam for the geofence config ETag.
// Geofence config itself (versioned document, PUT/If-Match flow) is NOT implemented until
// B5 (specs/001 §7). POST /locations only needs the current ETag to piggyback in its
// response so devices notice a config change and re-sync (§5.1). "0" is the documented
// sentinel for "no config uploaded yet" (§7.1).

export interface GeofenceConfigRepo {
  /** Current config blob ETag for the family, or "0" when no config exists yet (001 §7.1). */
  getEtag(familyId: string): Promise<string>;
}
