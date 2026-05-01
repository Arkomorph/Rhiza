import neo4j from 'neo4j-driver';
import { config } from '../config.js';

const driver = neo4j.driver(
  config.NEO4J_URI,
  config.NEO4J_PASSWORD
    ? neo4j.auth.basic(config.NEO4J_USER, config.NEO4J_PASSWORD)
    : undefined,
  {
    maxConnectionPoolSize: 10,
    connectionAcquisitionTimeout: 10_000,
  }
);

export async function runCypher<T = Record<string, unknown>>(
  cypher: string,
  params: Record<string, unknown> = {},
): Promise<T[]> {
  const session = driver.session();
  try {
    const result = await session.run(cypher, params);
    return result.records.map(r => r.toObject() as T);
  } finally {
    await session.close();
  }
}

export default driver;
