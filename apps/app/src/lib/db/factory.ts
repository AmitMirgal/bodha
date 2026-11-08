import type { SqlDriverAdapterFactory } from "@prisma/driver-adapter-utils";
import { PrismaClient } from "../../generated/prisma/client";

export function createPrismaClient(
	adapter: SqlDriverAdapterFactory
): PrismaClient {
	return new PrismaClient({ adapter });
}
