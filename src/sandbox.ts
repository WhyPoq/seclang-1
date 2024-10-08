import {
	Limits,
	SeclangFunction,
	SeclangList,
	SeclangNumber,
	SeclangStdout,
	SeclangString,
	SeclangValue,
	SymbolTable,
} from "./seclangCore";
import { run } from "./seclangCore";

export class CodeError extends Error {
	constructor(message: string | undefined = undefined) {
		super(message);
		Object.setPrototypeOf(this, CodeError.prototype);
	}
}

export class JsToSeclangValueConvertionError extends Error {
	constructor(message: string | undefined = undefined) {
		super(message);
		Object.setPrototypeOf(this, JsToSeclangValueConvertionError.prototype);
	}
}

interface EnvironmentInput {
	[key: string]: jsToSeclangValueConvertable;
}

interface EnvironmentOutput {
	[key: string]: SeclangValue;
}

interface sandboxRunResult {
	stdout: string[];
	globalSymbols: EnvironmentOutput;
	result: SeclangValue;
}

type jsToSeclangValueConvertableUnit = number | string | SeclangValue;
export type jsToSeclangValueConvertable =
	| jsToSeclangValueConvertableUnit
	| jsToSeclangValueConvertableUnit[];

type seclangValueToJSReturnType =
	| number
	| string
	| SeclangValue
	| seclangValueToJSReturnType[]
	| ((
			args: jsToSeclangValueConvertable[],
			logOutput: boolean,
			stdout: SeclangStdout | undefined,
			instructionsLimit: number
	  ) => seclangValueToJSReturnType);

export type FunctionFromSeclang = (
	args: jsToSeclangValueConvertable[],
	logOutput: boolean,
	stdout: SeclangStdout | undefined,
	instructionsLimit: number
) => seclangValueToJSReturnType;

export function seclangValueToJS(secVal: SeclangNumber): number;
export function seclangValueToJS(secVal: SeclangString): string;
export function seclangValueToJS(secVal: SeclangList): seclangValueToJSReturnType[];
export function seclangValueToJS(secVal: SeclangFunction): FunctionFromSeclang;

export function seclangValueToJS(secVal: SeclangValue): seclangValueToJSReturnType;

export function seclangValueToJS(secVal: SeclangValue): seclangValueToJSReturnType {
	if (secVal instanceof SeclangNumber) return secVal.value;
	if (secVal instanceof SeclangString) return secVal.value;
	if (secVal instanceof SeclangList)
		return secVal.elements.map((el) => seclangValueToJS(el)) as ReturnType<
			typeof seclangValueToJS
		>[];
	if (secVal instanceof SeclangFunction) {
		return function (
			args: jsToSeclangValueConvertable[],
			logOutput: boolean,
			stdout: SeclangStdout,
			instructionsLimit: number
		) {
			const convertedArgs = args.map((arg) => jsToSeclangValue(arg));
			const res = secVal.execute(convertedArgs, logOutput, stdout, {
				cur: 0,
				limit: instructionsLimit,
			});

			return seclangValueToJS(res.returningVal);
		};
	}

	return secVal;
}

export function jsToSeclangValue(value: jsToSeclangValueConvertable): SeclangValue {
	if (typeof value === "number") return new SeclangNumber(value);
	if (typeof value === "string") return new SeclangString(value);
	if (Array.isArray(value)) return new SeclangList(value.map((el) => jsToSeclangValue(el)));

	return value;
}

export function sandboxRun(
	programText: string,
	limits: Limits,
	stdoutLimit: number = 30,
	filename: string = "<program>",
	environment: EnvironmentInput = {}
): sandboxRunResult {
	const stdout = new SeclangStdout(stdoutLimit);

	const innerGlobalSymbolTable = new SymbolTable();
	for (const key in environment) {
		innerGlobalSymbolTable.setNew(key, jsToSeclangValue(environment[key]));
	}

	const runResult = run(programText, filename, limits, false, stdout, innerGlobalSymbolTable);

	if (runResult.error) throw new CodeError(runResult.error.toString());

	return {
		stdout: stdout.getValues(),
		globalSymbols: Object.fromEntries(innerGlobalSymbolTable.symbols),
		result: runResult.result,
	};
}
