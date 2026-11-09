import type { SqlDriverAdapterFactory } from "@prisma/driver-adapter-utils";
import { PrismaClient } from "../../generated/prisma/client";
import type { PrismaInteractiveTransactionOptions } from "./connect-options";

export function createPrismaClient(
	adapter: SqlDriverAdapterFactory,
	options?: { transactionOptions?: PrismaInteractiveTransactionOptions }
): PrismaClient {
	if (options?.transactionOptions) {
		return new PrismaClient({
			adapter,
			transactionOptions: options.transactionOptions,
		});
	}
	return new PrismaClient({ adapter });
}
