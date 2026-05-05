-- Extension du CHECK constraint sur schema_audit.resource_type pour inclure 'sources'
-- Idempotent via DROP IF EXISTS + re-CREATE

ALTER TABLE config.schema_audit DROP CONSTRAINT IF EXISTS schema_audit_resource_type_check;
ALTER TABLE config.schema_audit ADD CONSTRAINT schema_audit_resource_type_check
  CHECK (resource_type IN ('types', 'properties', 'edges', 'edge_properties', 'expected_edges', 'sources'));
