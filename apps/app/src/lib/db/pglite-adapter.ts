import type { PGlite } from "@electric-sql/pglite";
import {
	ColumnTypeEnum,
	DriverAdapterError,
	type IsolationLevel,
	type SqlDriverAdapter,
	type SqlDriverAdapterFactory,
	type SqlQuery,
	type SqlResultSet,
	type Transaction,
} from "@prisma/driver-adapter-utils";

const info = {
	provider: "postgres" as const,
	adapterName: "mati-pglite",
};

function mapColumnType(
	oid: number
): (typeof ColumnTypeEnum)[keyof typeof ColumnTypeEnum] {
	switch (oid) {
		case 16:
			return ColumnTypeEnum.Boolean;
		case 20:
			return ColumnTypeEnum.Int64;
		case 21:
		case 23:
			return ColumnTypeEnum.Int32;
		case 700:
			return ColumnTypeEnum.Float;
		case 701:
			return ColumnTypeEnum.Double;
		case 1700:
			return ColumnTypeEnum.Numeric;
		case 1082:
			return ColumnTypeEnum.Date;
		case 1083:
			return ColumnTypeEnum.Time;
		case 1114:
		case 1184:
			return ColumnTypeEnum.DateTime;
		case 114:
		case 3802:
			return ColumnTypeEnum.Json;
		case 17:
			return ColumnTypeEnum.Bytes;
		case 2950:
			return ColumnTypeEnum.Uuid;
		default:
			return ColumnTypeEnum.Text;
	}
}

function normalizeResultValue(
	value: unknown,
	columnType: (typeof ColumnTypeEnum)[keyof typeof ColumnTypeEnum]
): unknown {
	if (value === null || value === undefined) {
		return null;
	}
	if (typeof value === "bigint") {
		return value.toString();
	}
	if (value instanceof Date) {
		return value.toISOString();
	}
	if (
		columnType === ColumnTypeEnum.Json ||
		columnType === ColumnTypeEnum.JsonArray
	) {
		return typeof value === "string" ? value : JSON.stringify(value);
	}
	if (typeof value === "object" && !ArrayBuffer.isView(value)) {
		return JSON.stringify(value);
	}
	return value;
}

function mapArg(arg: unknown): unknown {
	if (arg === null || arg === undefined) {
		return null;
	}
	if (arg instanceof Date) {
		return arg.toISOString();
	}
	if (typeof arg === "bigint") {
		return arg.toString();
	}
	if (ArrayBuffer.isView(arg)) {
		return arg;
	}
	if (typeof arg === "object") {
		return JSON.stringify(arg);
	}
	return arg;
}

function wrapError(error: unknown): never {
	const err = error as {
		code?: string;
		message?: string;
		severity?: string;
		detail?: string;
		column?: string;
		hint?: string;
	};
	if (err.code === "23505") {
		throw new DriverAdapterError({
			kind: "UniqueConstraintViolation",
			constraint: undefined,
		});
	}
	if (err.code === "23503") {
		throw new DriverAdapterError({
			kind: "ForeignKeyConstraintViolation",
			constraint: undefined,
		});
	}
	throw new DriverAdapterError({
		kind: "postgres",
		code: err.code ?? "N/A",
		severity: err.severity ?? "ERROR",
		message: err.message ?? String(error),
		detail: err.detail,
		column: err.column,
		hint: err.hint,
	});
}

class PgliteQueryable {
	readonly provider = info.provider;
	readonly adapterName = info.adapterName;
	protected readonly db: Pick<PGlite, "query" | "exec">;

	constructor(db: Pick<PGlite, "query" | "exec">) {
		this.db = db;
	}

	async queryRaw(query: SqlQuery): Promise<SqlResultSet> {
		try {
			const mapped = query.args.map(mapArg);
			const result = await this.db.query(query.sql, mapped, {
				rowMode: "array",
			});
			const fields = result.fields ?? [];
			const columnTypes = fields.map((field) =>
				mapColumnType(field.dataTypeID)
			);
			return {
				columnNames: fields.map((field) => field.name),
				columnTypes,
				rows: ((result.rows as unknown as unknown[][]) ?? []).map((row) =>
					row.map((value, index) =>
						normalizeResultValue(value, columnTypes[index])
					)
				),
			};
		} catch (error) {
			wrapError(error);
		}
	}

	async executeRaw(query: SqlQuery): Promise<number> {
		try {
			const mapped = query.args.map(mapArg);
			const result = await this.db.query(query.sql, mapped);
			return (
				(result as { affectedRows?: number }).affectedRows ?? result.rows.length
			);
		} catch (error) {
			wrapError(error);
		}
	}
}

class PgliteTransaction extends PgliteQueryable implements Transaction {
	readonly options = { usePhantomQuery: false };

	async commit(): Promise<void> {
		await this.db.exec("COMMIT");
	}

	async rollback(): Promise<void> {
		await this.db.exec("ROLLBACK");
	}
}

class PgliteAdapter extends PgliteQueryable implements SqlDriverAdapter {
	async executeScript(script: string): Promise<void> {
		await this.db.exec(script);
	}

	async startTransaction(
		_isolationLevel?: IsolationLevel
	): Promise<Transaction> {
		await this.db.exec("BEGIN");
		return new PgliteTransaction(this.db);
	}

	getConnectionInfo() {
		return { supportsRelationJoins: false };
	}

	async dispose(): Promise<void> {
		// The PGlite instance is owned by the test harness.
	}
}

export class PrismaPglite implements SqlDriverAdapterFactory {
	readonly provider = info.provider;
	readonly adapterName = info.adapterName;
	private readonly db: PGlite;

	constructor(db: PGlite) {
		this.db = db;
	}

	async connect(): Promise<SqlDriverAdapter> {
		return await Promise.resolve(new PgliteAdapter(this.db));
	}
}
