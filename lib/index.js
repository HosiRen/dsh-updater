import { D as repoFacts, E as remoteHead, S as newRunId, a as openCheckRecordStore, c as readRun, d as writeRun, h as appendTail, i as newRunLogPath, l as releaseRunLock, m as STDERR_TAIL_BYTES, n as appendLog, o as pruneLogs, r as isRunActive, s as readLogTail, t as acquireRunLock, u as updaterPaths, v as describeError$1, y as describeErrorDetail } from "./state-I0bd_gXn.js";
import { homedir } from "node:os";
import path, { join } from "node:path";
import { setTimeout } from "node:timers/promises";
import { spawn } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { closeSync, openSync } from "node:fs";
import { fileURLToPath } from "node:url";
//#region ../../vendor/cosmokit/src/misc.ts
/** Return true when a value is `null` or `undefined`. */
function isNullable(value) {
	return value === null || value === void 0;
}
/** Return true for non-array object values. */
function isPlainObject(data) {
	return data && typeof data === "object" && !Array.isArray(data);
}
/** Filter object entries and return a new object. */
function filterKeys(object, filter) {
	return Object.fromEntries(Object.entries(object).filter(([key, value]) => filter(key, value)));
}
/** Map object values while preserving the original key set. */
function mapValues(object, transform) {
	return Object.fromEntries(Object.entries(object).map(([key, value]) => [key, transform(value, key)]));
}
/** Pick selected keys from an object, optionally including `undefined` values. */
function pick(source, keys, forced) {
	if (!keys) return { ...source };
	const result = {};
	for (const key of keys) if (forced || source[key] !== void 0) result[key] = source[key];
	return result;
}
//#endregion
//#region ../../vendor/cosmokit/src/volatile.ts
/** Shared config references used by schema validators and plugin runtimes. */
const write = Symbol.for("cosmokit.volatile.write");
function snapshot(value, ancestors = /* @__PURE__ */ new Set()) {
	if (typeof value === "function") throw new TypeError("volatile config cannot contain functions");
	if (value === null || typeof value !== "object") return value;
	if (ancestors.has(value)) throw new TypeError("volatile config cannot contain cycles");
	ancestors.add(value);
	try {
		if (Array.isArray(value)) return Object.freeze(value.map((item) => snapshot(item, ancestors)));
		if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) throw new TypeError("volatile config objects must be plain objects or arrays");
		return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, item]) => [key, snapshot(item, ancestors)])));
	} finally {
		ancestors.delete(value);
	}
}
/**
* Create a detached reference containing an immutable copy of the supplied data.
* @param value - validated config data; class instances and functions are unsupported.
* @returns a reference whose value is updated only by its owning runtime.
*/
function createVolatile(value) {
	let current = snapshot(value);
	return Object.freeze({
		get: () => current,
		[write]: (value) => {
			current = value;
		}
	});
}
/**
* Identify references across ESM/CJS copies of the shared library.
* @param value - a parsed config value.
* @returns whether the value implements the shared reference protocol.
*/
function isVolatile(value) {
	return typeof value === "object" && value !== null && write in value;
}
//#endregion
//#region ../../vendor/cosmokit/src/types.ts
/** Test values using `instanceof` with a `toStringTag` fallback. */
function is(type, value) {
	if (arguments.length === 1) return (value) => is(type, value);
	return type in globalThis && value instanceof globalThis[type] || Object.prototype.toString.call(value).slice(8, -1) === type;
}
function isArrayBufferLike(value) {
	return is("ArrayBuffer", value) || is("SharedArrayBuffer", value);
}
function isArrayBufferSource(value) {
	return isArrayBufferLike(value) || ArrayBuffer.isView(value);
}
let Binary;
(function(_Binary) {
	_Binary.is = isArrayBufferLike;
	_Binary.isSource = isArrayBufferSource;
	function fromSource(source) {
		if (ArrayBuffer.isView(source)) return source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
		else return source;
	}
	_Binary.fromSource = fromSource;
	function toBase64(source) {
		source = fromSource(source);
		if (typeof Buffer !== "undefined") return Buffer.from(source).toString("base64");
		let binary = "";
		const bytes = new Uint8Array(source);
		for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
		return btoa(binary);
	}
	_Binary.toBase64 = toBase64;
	function fromBase64(source) {
		if (typeof Buffer !== "undefined") return fromSource(Buffer.from(source, "base64"));
		return Uint8Array.from(atob(source), (c) => c.charCodeAt(0));
	}
	_Binary.fromBase64 = fromBase64;
	function toHex(source) {
		source = fromSource(source);
		if (typeof Buffer !== "undefined") return Buffer.from(source).toString("hex");
		return Array.from(new Uint8Array(source), (byte) => byte.toString(16).padStart(2, "0")).join("");
	}
	_Binary.toHex = toHex;
	function fromHex(source) {
		if (typeof Buffer !== "undefined") return fromSource(Buffer.from(source, "hex"));
		const hex = source.length % 2 === 0 ? source : source.slice(0, source.length - 1);
		const buffer = [];
		for (let i = 0; i < hex.length; i += 2) buffer.push(parseInt(`${hex[i]}${hex[i + 1]}`, 16));
		return Uint8Array.from(buffer).buffer;
	}
	_Binary.fromHex = fromHex;
})(Binary || (Binary = {}));
Binary.fromBase64;
Binary.toBase64;
Binary.fromHex;
Binary.toHex;
/** Deep-clone common JavaScript values while preserving prototypes and cycles. */
function clone(source, refs = /* @__PURE__ */ new Map()) {
	if (!source || typeof source !== "object") return source;
	if (is("Date", source)) return new Date(source.valueOf());
	if (is("RegExp", source)) return new RegExp(source.source, source.flags);
	if (isArrayBufferLike(source)) return source.slice(0);
	if (ArrayBuffer.isView(source)) return source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
	const cached = refs.get(source);
	if (cached) return cached;
	if (Array.isArray(source)) {
		const result = [];
		refs.set(source, result);
		source.forEach((value, index) => {
			result[index] = Reflect.apply(clone, null, [value, refs]);
		});
		return result;
	}
	const result = Object.create(Object.getPrototypeOf(source));
	refs.set(source, result);
	for (const key of Reflect.ownKeys(source)) {
		const descriptor = { ...Reflect.getOwnPropertyDescriptor(source, key) };
		if ("value" in descriptor) descriptor.value = Reflect.apply(clone, null, [descriptor.value, refs]);
		Reflect.defineProperty(result, key, descriptor);
	}
	return result;
}
/**
* Compare values recursively, treating two volatile references as equal regardless of value.
* Strict comparison distinguishes null/undefined, treats opaque objects by identity,
* compares URLs by normalized href, treats array holes as undefined, and considers distinct cyclic structures unequal.
* @param a - first value.
* @param b - second value.
* @param strict - whether to require strict data equality outside volatile references.
* @returns whether the values compare equal.
*/
function deepEqual(a, b, strict) {
	const ancestors = /* @__PURE__ */ new Set();
	function compare(a, b) {
		if (a === b) return true;
		if (isVolatile(a) || isVolatile(b)) return isVolatile(a) && isVolatile(b);
		if (!strict && isNullable(a) && isNullable(b)) return true;
		if (typeof a !== typeof b || typeof a !== "object" || !a || !b) return false;
		if (ancestors.has(a)) return false;
		function check(test, then) {
			return test(a) ? test(b) ? then(a, b) : false : test(b) ? false : void 0;
		}
		ancestors.add(a);
		try {
			return check(Array.isArray, (a, b) => {
				if (a.length !== b.length) return false;
				for (let index = 0; index < a.length; index++) if (!compare(a[index], b[index])) return false;
				return true;
			}) ?? check(is("Date"), (a, b) => a.valueOf() === b.valueOf()) ?? check(is("URL"), (a, b) => a.href === b.href) ?? check(is("RegExp"), (a, b) => a.source === b.source && a.flags === b.flags) ?? check(isArrayBufferLike, (a, b) => {
				if (a.byteLength !== b.byteLength) return false;
				const viewA = new Uint8Array(a);
				const viewB = new Uint8Array(b);
				for (let i = 0; i < viewA.length; i++) if (viewA[i] !== viewB[i]) return false;
				return true;
			}) ?? ((!strict || [a, b].every((value) => Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)) && Object.keys({
				...a,
				...b
			}).every((key) => compare(a[key], b[key])));
		} finally {
			ancestors.delete(a);
		}
	}
	return compare(a, b);
}
//#endregion
//#region ../../vendor/cosmokit/src/time.ts
let Time;
(function(_Time) {
	_Time.millisecond = 1;
	const second = _Time.second = 1e3;
	const minute = _Time.minute = second * 60;
	const hour = _Time.hour = minute * 60;
	const day = _Time.day = hour * 24;
	const week = _Time.week = day * 7;
	let timezoneOffset = (/* @__PURE__ */ new Date()).getTimezoneOffset();
	function setTimezoneOffset(offset) {
		timezoneOffset = offset;
	}
	_Time.setTimezoneOffset = setTimezoneOffset;
	function getTimezoneOffset() {
		return timezoneOffset;
	}
	_Time.getTimezoneOffset = getTimezoneOffset;
	function getDateNumber(date = /* @__PURE__ */ new Date(), offset) {
		if (typeof date === "number") date = new Date(date);
		if (offset === void 0) offset = timezoneOffset;
		return Math.floor((date.valueOf() / minute - offset) / 1440);
	}
	_Time.getDateNumber = getDateNumber;
	function fromDateNumber(value, offset) {
		const date = new Date(value * day);
		if (offset === void 0) offset = timezoneOffset;
		return new Date(+date + offset * minute);
	}
	_Time.fromDateNumber = fromDateNumber;
	const numeric = /\d+(?:\.\d+)?/.source;
	const timeRegExp = new RegExp(`^${[
		"w(?:eek(?:s)?)?",
		"d(?:ay(?:s)?)?",
		"h(?:our(?:s)?)?",
		"m(?:in(?:ute)?(?:s)?)?",
		"s(?:ec(?:ond)?(?:s)?)?"
	].map((unit) => `(${numeric}${unit})?`).join("")}$`);
	function parseTime(source) {
		const capture = timeRegExp.exec(source);
		if (!capture) return 0;
		return (parseFloat(capture[1]) * week || 0) + (parseFloat(capture[2]) * day || 0) + (parseFloat(capture[3]) * hour || 0) + (parseFloat(capture[4]) * minute || 0) + (parseFloat(capture[5]) * second || 0);
	}
	_Time.parseTime = parseTime;
	function parseDate(date) {
		const parsed = parseTime(date);
		if (parsed) date = Date.now() + parsed;
		else if (/^\d{1,2}(:\d{1,2}){1,2}$/.test(date)) date = `${(/* @__PURE__ */ new Date()).toLocaleDateString()}-${date}`;
		else if (/^\d{1,2}-\d{1,2}-\d{1,2}(:\d{1,2}){1,2}$/.test(date)) date = `${(/* @__PURE__ */ new Date()).getFullYear()}-${date}`;
		return date ? new Date(date) : /* @__PURE__ */ new Date();
	}
	_Time.parseDate = parseDate;
	function format(ms) {
		const abs = Math.abs(ms);
		if (abs >= day - hour / 2) return Math.round(ms / day) + "d";
		else if (abs >= hour - minute / 2) return Math.round(ms / hour) + "h";
		else if (abs >= minute - second / 2) return Math.round(ms / minute) + "m";
		else if (abs >= second) return Math.round(ms / second) + "s";
		return ms + "ms";
	}
	_Time.format = format;
	function toDigits(source, length = 2) {
		return source.toString().padStart(length, "0");
	}
	_Time.toDigits = toDigits;
	function template(template, time = /* @__PURE__ */ new Date()) {
		return template.replace("yyyy", time.getFullYear().toString()).replace("yy", time.getFullYear().toString().slice(2)).replace("MM", toDigits(time.getMonth() + 1)).replace("dd", toDigits(time.getDate())).replace("hh", toDigits(time.getHours())).replace("mm", toDigits(time.getMinutes())).replace("ss", toDigits(time.getSeconds())).replace("SSS", toDigits(time.getMilliseconds(), 3));
	}
	_Time.template = template;
})(Time || (Time = {}));
//#endregion
//#region ../../vendor/schemastery/src/index.ts
const kSchema = Symbol.for("schemastery");
const kValidationError = Symbol.for("ValidationError");
globalThis.__schemastery_index__ ??= 0;
globalThis.__schemastery_refs__ = void 0;
var ValidationError = class extends TypeError {
	options;
	name = "ValidationError";
	constructor(message, options) {
		let prefix = "$";
		for (const segment of options.path || []) if (typeof segment === "string") prefix += "." + segment;
		else if (typeof segment === "number") prefix += "[" + segment + "]";
		else if (typeof segment === "symbol") prefix += `[Symbol(${segment.toString()})]`;
		if (prefix.startsWith(".")) prefix = prefix.slice(1);
		super((prefix === "$" ? "" : `${prefix} `) + message);
		this.options = options;
	}
	static is(error) {
		return !!error?.[kValidationError];
	}
};
Object.defineProperty(ValidationError.prototype, kValidationError, { value: true });
const Schema = function(options) {
	const schema = function(data, options = {}) {
		return Schema.resolve(data, schema, options)[0];
	};
	if (options.refs) {
		const refs = mapValues(options.refs, (options) => new Schema(options));
		const getRef = (uid) => refs[uid];
		for (const key in refs) {
			const options = refs[key];
			options.sKey = getRef(options.sKey);
			options.inner = getRef(options.inner);
			options.list = options.list && options.list.map(getRef);
			options.dict = options.dict && mapValues(options.dict, getRef);
		}
		return refs[options.uid];
	}
	Object.assign(schema, options);
	if (typeof schema.callback === "string") try {
		schema.callback = new Function("return " + schema.callback)();
	} catch {}
	Object.defineProperty(schema, "uid", { value: globalThis.__schemastery_index__++ });
	Object.setPrototypeOf(schema, Schema.prototype);
	schema.meta ||= {};
	schema.toString = schema.toString.bind(schema);
	return schema;
};
Schema.prototype = Object.create(Function.prototype);
Schema.prototype[kSchema] = true;
Object.defineProperty(Schema.prototype, "~standard", { get() {
	return {
		version: 1,
		vendor: "schemastery",
		validate: (value) => {
			try {
				return { value: Schema.resolve(value, this, {})[0] };
			} catch (error) {
				if (ValidationError.is(error)) return { issues: [{
					message: error.message,
					path: error.options.path
				}] };
				throw error;
			}
		}
	};
} });
Schema.ValidationError = ValidationError;
Schema.prototype.toJSON = function toJSON() {
	if (globalThis.__schemastery_refs__) {
		globalThis.__schemastery_refs__[this.uid] ??= JSON.parse(JSON.stringify({ ...this }));
		return this.uid;
	}
	globalThis.__schemastery_refs__ = { [this.uid]: { ...this } };
	globalThis.__schemastery_refs__[this.uid] = JSON.parse(JSON.stringify({ ...this }));
	const result = {
		uid: this.uid,
		refs: globalThis.__schemastery_refs__
	};
	globalThis.__schemastery_refs__ = void 0;
	return result;
};
Schema.prototype.set = function set(key, value) {
	this.dict[key] = value;
	return this;
};
Schema.prototype.push = function push(value) {
	this.list.push(value);
	return this;
};
function mergeDesc(original, messages) {
	const result = typeof original === "string" ? { "": original } : { ...original };
	for (const locale in messages) {
		const value = messages[locale];
		if (value?.$description || value?.$desc) result[locale] = value.$description || value.$desc;
		else if (typeof value === "string") result[locale] = value;
	}
	return result;
}
function getInner(value) {
	return value?.$value ?? value?.$inner;
}
function extractKeys(data) {
	return filterKeys(data ?? {}, (key) => !key.startsWith("$"));
}
Schema.prototype.i18n = function i18n(messages) {
	const schema = Schema(this);
	const desc = mergeDesc(schema.meta.description, messages);
	if (Object.keys(desc).length) schema.meta.description = desc;
	if (schema.dict) schema.dict = mapValues(schema.dict, (inner, key) => {
		return inner.i18n(mapValues(messages, (data) => getInner(data)?.[key] ?? data?.[key]));
	});
	if (schema.list) schema.list = schema.list.map((inner, index) => {
		return inner.i18n(mapValues(messages, (data = {}) => {
			if (Array.isArray(getInner(data))) return getInner(data)[index];
			if (Array.isArray(data)) return data[index];
			return extractKeys(data);
		}));
	});
	if (schema.inner) schema.inner = schema.inner.i18n(mapValues(messages, (data) => {
		if (getInner(data)) return getInner(data);
		return extractKeys(data);
	}));
	if (schema.sKey) schema.sKey = schema.sKey.i18n(mapValues(messages, (data) => data?.$key));
	return schema;
};
Schema.prototype.extra = function extra(key, value) {
	const schema = Schema(this);
	schema.meta = {
		...schema.meta,
		[key]: value
	};
	return schema;
};
for (const key of [
	"required",
	"disabled",
	"collapse",
	"hidden",
	"loose"
]) Object.assign(Schema.prototype, { [key](value = true) {
	const schema = Schema(this);
	schema.meta = {
		...schema.meta,
		[key]: value
	};
	return schema;
} });
Schema.prototype.deprecated = function deprecated() {
	const schema = Schema(this);
	schema.meta.badges ||= [];
	schema.meta.badges.push({
		text: "deprecated",
		type: "danger"
	});
	return schema;
};
Schema.prototype.experimental = function experimental() {
	const schema = Schema(this);
	schema.meta.badges ||= [];
	schema.meta.badges.push({
		text: "experimental",
		type: "warning"
	});
	return schema;
};
Schema.prototype.pattern = function pattern(regexp) {
	const schema = Schema(this);
	const pattern = pick(regexp, ["source", "flags"]);
	schema.meta = {
		...schema.meta,
		pattern
	};
	return schema;
};
Schema.prototype.simplify = function simplify(value) {
	if (isVolatile(value)) value = value.get();
	if (deepEqual(value, this.meta.default, this.type === "dict")) return null;
	if (isNullable(value)) return value;
	if (this.type === "object" || this.type === "dict") {
		const result = {};
		for (const key in value) {
			const item = (this.type === "object" ? this.dict[key] : this.inner)?.simplify(value[key]);
			if (this.type === "dict" || !isNullable(item)) result[key] = item;
		}
		if (deepEqual(result, this.meta.default, this.type === "dict")) return null;
		return result;
	} else if (this.type === "array" || this.type === "tuple") {
		const result = [];
		value.forEach((value, index) => {
			const schema = this.type === "array" ? this.inner : this.list[index];
			const item = schema ? schema.simplify(value) : value;
			result.push(item);
		});
		return result;
	} else if (this.type === "intersect") {
		const result = {};
		for (const item of this.list) Object.assign(result, item.simplify(value));
		return result;
	} else if (this.type === "union") for (const schema of this.list) try {
		Schema.resolve(value, schema, {});
		return schema.simplify(value);
	} catch {}
	return value;
};
Schema.prototype.toString = function toString(inline) {
	return formatters[this.type]?.(this, inline) ?? `Schema<${this.type}>`;
};
Schema.prototype.role = function role(role, extra) {
	const schema = Schema(this);
	schema.meta = {
		...schema.meta,
		role,
		extra
	};
	return schema;
};
for (const key of [
	"default",
	"link",
	"comment",
	"description",
	"max",
	"min",
	"step"
]) Object.assign(Schema.prototype, { [key](value) {
	const schema = Schema(this);
	schema.meta = {
		...schema.meta,
		[key]: value
	};
	return schema;
} });
Schema.prototype.volatile = function volatile() {
	if (this.meta.volatile) throw new TypeError("volatile schema is already wrapped");
	return this.extra("volatile", true);
};
const resolvers = {};
const checkedVolatile = Symbol("checked-volatile-schema");
function validateVolatileSchema(schema, path = [], blocked = false, seen = /* @__PURE__ */ new Map()) {
	const states = seen.get(schema) ?? /* @__PURE__ */ new Set();
	if (states.has(blocked)) return;
	states.add(blocked);
	seen.set(schema, states);
	if (schema.meta?.volatile && blocked) throw new ValidationError("volatile fields require a fixed object path without an enclosing volatile field", { path });
	const nested = blocked || !!schema.meta?.volatile;
	if (schema.dict) for (const [key, child] of Object.entries(schema.dict)) validateVolatileSchema(child, [...path, key], nested, seen);
	if (schema.sKey) validateVolatileSchema(schema.sKey, [...path, "<key>"], true, seen);
	if (schema.inner && (schema.type !== "lazy" || schema.inner[kSchema])) validateVolatileSchema(schema.inner, [...path, "*"], true, seen);
	if (schema.list) for (let index = 0; index < schema.list.length; index++) validateVolatileSchema(schema.list[index], [...path, String(index)], true, seen);
}
Schema.extend = function extend(type, resolve) {
	resolvers[type] = resolve;
};
Schema.resolve = function resolve(data, schema, options = {}, strict = false) {
	if (!schema) return [data];
	if (!options[checkedVolatile]) {
		validateVolatileSchema(schema, options.path);
		options = {
			...options,
			[checkedVolatile]: true
		};
	}
	if (schema.meta?.volatile) {
		const inner = Schema(schema);
		inner.meta = {
			...schema.meta,
			volatile: false
		};
		const [value, adapted] = Schema.resolve(data, inner, options, strict);
		try {
			return [createVolatile(value), adapted];
		} catch (error) {
			throw new ValidationError(error instanceof Error ? error.message : String(error), options);
		}
	}
	if (options.ignore?.(data, schema)) return [data];
	if (isNullable(data) && schema.type !== "lazy") {
		if (schema.meta.required) throw new ValidationError(`missing required value`, options);
		let current = schema;
		let fallback = schema.meta.default;
		while (current?.type === "intersect" && isNullable(fallback)) {
			current = current.list[0];
			fallback = current?.meta.default;
		}
		if (isNullable(fallback)) return [data];
		data = clone(fallback);
	}
	const callback = resolvers[schema.type];
	if (!callback) throw new ValidationError(`unsupported type "${schema.type}"`, options);
	try {
		return callback(data, schema, options, strict);
	} catch (error) {
		if (!schema.meta.loose) throw error;
		return [schema.meta.default];
	}
};
Schema.from = function from(source) {
	if (isNullable(source)) return Schema.any();
	else if ([
		"string",
		"number",
		"boolean"
	].includes(typeof source)) return Schema.const(source).required();
	else if (source[kSchema]) return source;
	else if (typeof source === "function") switch (source) {
		case String: return Schema.string().required();
		case Number: return Schema.number().required();
		case Boolean: return Schema.boolean().required();
		case Function: return Schema.function().required();
		default: return Schema.is(source).required();
	}
	else throw new TypeError(`cannot infer schema from ${source}`);
};
Schema.lazy = function lazy(builder) {
	const toJSON = () => {
		if (!schema.inner[kSchema]) {
			schema.inner = schema.builder();
			schema.inner.meta = {
				...schema.meta,
				...schema.inner.meta
			};
		}
		return schema.inner.toJSON();
	};
	const schema = new Schema({
		type: "lazy",
		builder,
		inner: { toJSON }
	});
	return schema;
};
Schema.natural = function natural() {
	return Schema.number().step(1).min(0);
};
Schema.percent = function percent() {
	return Schema.number().step(.01).min(0).max(1).role("slider");
};
Schema.date = function date() {
	return Schema.union([Schema.is(Date), Schema.transform(Schema.string().role("datetime"), (value, options) => {
		const date = new Date(value);
		if (isNaN(+date)) throw new ValidationError(`invalid date "${value}"`, options);
		return date;
	}, true)]);
};
Schema.regExp = function regExp(flag = "") {
	return Schema.union([Schema.is(RegExp), Schema.transform(Schema.string().role("regexp", { flag }), (value, options) => {
		try {
			return new RegExp(value, flag);
		} catch (e) {
			throw new ValidationError(e.message, options);
		}
	}, true)]);
};
Schema.arrayBuffer = function arrayBuffer(encoding) {
	return Schema.union([
		Schema.is(ArrayBuffer),
		Schema.is(SharedArrayBuffer),
		Schema.transform(Schema.any(), (value, options) => {
			if (Binary.isSource(value)) return Binary.fromSource(value);
			throw new ValidationError(`expected ArrayBufferSource but got ${value}`, options);
		}, true),
		...encoding ? [Schema.transform(Schema.string(), (value, options) => {
			try {
				return encoding === "base64" ? Binary.fromBase64(value) : Binary.fromHex(value);
			} catch (e) {
				throw new ValidationError(e.message, options);
			}
		}, true)] : []
	]);
};
Schema.extend("lazy", (data, schema, options, strict) => {
	if (!schema.inner[kSchema]) {
		schema.inner = schema.builder();
		schema.inner.meta = {
			...schema.meta,
			...schema.inner.meta
		};
		validateVolatileSchema(schema.inner, options.path, true);
	}
	return Schema.resolve(data, schema.inner, options, strict);
});
Schema.extend("any", (data) => {
	return [data];
});
Schema.extend("never", (data, _, options) => {
	throw new ValidationError(`expected nullable but got ${data}`, options);
});
Schema.extend("const", (data, { value }, options) => {
	if (deepEqual(data, value)) return [value];
	throw new ValidationError(`expected ${value} but got ${data}`, options);
});
function checkWithinRange(data, meta, description, options, skipMin = false) {
	const { max = Infinity, min = -Infinity } = meta;
	if (data > max) throw new ValidationError(`expected ${description} <= ${max} but got ${data}`, options);
	if (data < min && !skipMin) throw new ValidationError(`expected ${description} >= ${min} but got ${data}`, options);
}
Schema.extend("string", (data, { meta }, options) => {
	if (typeof data !== "string") throw new ValidationError(`expected string but got ${data}`, options);
	if (meta.pattern) {
		const regexp = new RegExp(meta.pattern.source, meta.pattern.flags);
		if (!regexp.test(data)) throw new ValidationError(`expect string to match regexp ${regexp}`, options);
	}
	checkWithinRange(data.length, meta, "string length", options);
	return [data];
});
function decimalShift(data, digits) {
	const str = data.toString();
	if (str.includes("e")) return data * Math.pow(10, digits);
	const index = str.indexOf(".");
	if (index === -1) return data * Math.pow(10, digits);
	const frac = str.slice(index + 1);
	const integer = str.slice(0, index);
	if (frac.length <= digits) return +(integer + frac.padEnd(digits, "0"));
	return +(integer + frac.slice(0, digits) + "." + frac.slice(digits));
}
function isMultipleOf(data, min, step) {
	step = Math.abs(step);
	if (!/^\d+\.\d+$/.test(step.toString())) return (data - min) % step === 0;
	const index = step.toString().indexOf(".");
	const digits = step.toString().slice(index + 1).length;
	return Math.abs(decimalShift(data, digits) - decimalShift(min, digits)) % decimalShift(step, digits) === 0;
}
Schema.extend("number", (data, { meta }, options) => {
	if (typeof data !== "number") throw new ValidationError(`expected number but got ${data}`, options);
	checkWithinRange(data, meta, "number", options);
	const { step } = meta;
	if (step && !isMultipleOf(data, meta.min ?? 0, step)) throw new ValidationError(`expected number multiple of ${step} but got ${data}`, options);
	return [data];
});
Schema.extend("boolean", (data, _, options) => {
	if (typeof data === "boolean") return [data];
	throw new ValidationError(`expected boolean but got ${data}`, options);
});
Schema.extend("bitset", (data, { bits, meta }, options) => {
	let value = 0, keys = [];
	if (typeof data === "number") {
		value = data;
		for (const key in bits) if (data & bits[key]) keys.push(key);
	} else if (Array.isArray(data)) {
		keys = data;
		for (const key of keys) {
			if (typeof key !== "string") throw new ValidationError(`expected string but got ${key}`, options);
			if (key in bits) value |= bits[key];
		}
	} else throw new ValidationError(`expected number or array but got ${data}`, options);
	if (value === meta.default) return [value];
	return [value, keys];
});
Schema.extend("function", (data, _, options) => {
	if (typeof data === "function") return [data];
	throw new ValidationError(`expected function but got ${data}`, options);
});
Schema.extend("is", (data, { constructor }, options) => {
	if (typeof constructor === "function") {
		if (data instanceof constructor) return [data];
		throw new ValidationError(`expected ${constructor.name} but got ${data}`, options);
	} else {
		if (isNullable(data)) throw new ValidationError(`expected ${constructor} but got ${data}`, options);
		let prototype = Object.getPrototypeOf(data);
		while (prototype) {
			if (prototype.constructor?.name === constructor) return [data];
			prototype = Object.getPrototypeOf(prototype);
		}
		throw new ValidationError(`expected ${constructor} but got ${data}`, options);
	}
});
function property(data, key, schema, options) {
	try {
		const [value, adapted] = Schema.resolve(data[key], schema, {
			...options,
			path: [...options.path || [], key]
		});
		if (adapted !== void 0) data[key] = adapted;
		return value;
	} catch (e) {
		if (!options?.autofix) throw e;
		delete data[key];
		return schema.meta.volatile ? createVolatile(schema.meta.default) : schema.meta.default;
	}
}
Schema.extend("array", (data, { inner, meta }, options) => {
	if (!Array.isArray(data)) throw new ValidationError(`expected array but got ${data}`, options);
	checkWithinRange(data.length, meta, "array length", options, !isNullable(inner.meta.default));
	return [data.map((_, index) => property(data, index, inner, options))];
});
Schema.extend("dict", (data, { inner, sKey }, options, strict) => {
	if (!isPlainObject(data)) throw new ValidationError(`expected object but got ${data}`, options);
	const result = {};
	for (const key in data) {
		let rKey;
		try {
			rKey = Schema.resolve(key, sKey, options)[0];
		} catch (error) {
			if (strict) continue;
			throw error;
		}
		result[rKey] = property(data, key, inner, options);
		data[rKey] = data[key];
		if (key !== rKey) delete data[key];
	}
	return [result];
});
Schema.extend("tuple", (data, { list }, options, strict) => {
	if (!Array.isArray(data)) throw new ValidationError(`expected array but got ${data}`, options);
	const result = list.map((inner, index) => property(data, index, inner, options));
	if (strict) return [result];
	result.push(...data.slice(list.length));
	return [result];
});
function merge(result, data) {
	for (const key in data) {
		if (key in result) continue;
		result[key] = data[key];
	}
}
Schema.extend("object", (data, { dict }, options, strict) => {
	if (!isPlainObject(data)) throw new ValidationError(`expected object but got ${data}`, options);
	const result = {};
	for (const key in dict) {
		const value = property(data, key, dict[key], options);
		if (!isNullable(value) || key in data) result[key] = value;
	}
	if (!strict) merge(result, data);
	return [result];
});
Schema.extend("union", (data, { list, toString }, options, strict) => {
	const messages = [];
	for (const inner of list) try {
		return Schema.resolve(data, inner, options, strict);
	} catch (error) {
		messages.push(error);
	}
	throw new ValidationError(`expected ${toString()} but got ${JSON.stringify(data)}`, options);
});
Schema.extend("intersect", (data, { list, toString }, options, strict) => {
	if (!list.length) return [data];
	let result;
	for (const inner of list) {
		const value = Schema.resolve(data, inner, options, true)[0];
		if (isNullable(value)) continue;
		if (isNullable(result)) result = value;
		else if (typeof result !== typeof value) throw new ValidationError(`expected ${toString()} but got ${JSON.stringify(data)}`, options);
		else if (typeof value === "object") merge(result ??= {}, value);
		else if (result !== value) throw new ValidationError(`expected ${toString()} but got ${JSON.stringify(data)}`, options);
	}
	if (!strict && isPlainObject(data)) merge(result, data);
	return [result];
});
Schema.extend("transform", (data, { inner, callback, preserve }, options) => {
	const [result, adapted = data] = Schema.resolve(data, inner, options, true);
	if (preserve) return [callback(result)];
	else return [callback(result), callback(adapted)];
});
const formatters = {};
function defineMethod(name, keys, format) {
	formatters[name] = format;
	Object.assign(Schema, { [name](...args) {
		const schema = new Schema({ type: name });
		keys.forEach((key, index) => {
			switch (key) {
				case "sKey":
					schema.sKey = args[index] ?? Schema.string();
					break;
				case "inner":
					schema.inner = Schema.from(args[index]);
					break;
				case "list":
					schema.list = args[index].map(Schema.from);
					break;
				case "dict":
					schema.dict = mapValues(args[index], Schema.from);
					break;
				case "bits":
					schema.bits = {};
					for (const key in args[index]) {
						if (typeof args[index][key] !== "number") continue;
						schema.bits[key] = args[index][key];
					}
					break;
				case "callback": {
					const callback = schema.callback = args[index];
					callback["toJSON"] ||= () => callback.toString();
					break;
				}
				case "constructor": {
					const constructor = schema.constructor = args[index];
					if (typeof constructor === "function") constructor["toJSON"] ||= () => constructor["name"];
					break;
				}
				default: schema[key] = args[index];
			}
		});
		if (name === "object" || name === "dict") schema.meta.default = {};
		else if (name === "array" || name === "tuple") schema.meta.default = [];
		else if (name === "bitset") schema.meta.default = 0;
		return schema;
	} });
}
defineMethod("is", ["constructor"], ({ constructor }) => {
	if (typeof constructor === "function") return constructor.name;
	else return constructor;
});
defineMethod("any", [], () => "any");
defineMethod("never", [], () => "never");
defineMethod("const", ["value"], ({ value }) => typeof value === "string" ? JSON.stringify(value) : value);
defineMethod("string", [], () => "string");
defineMethod("number", [], () => "number");
defineMethod("boolean", [], () => "boolean");
defineMethod("bitset", ["bits"], () => "bitset");
defineMethod("function", [], () => "function");
defineMethod("array", ["inner"], ({ inner }) => `${inner.toString(true)}[]`);
defineMethod("dict", ["inner", "sKey"], ({ inner, sKey }) => `{ [key: ${sKey.toString()}]: ${inner.toString()} }`);
defineMethod("tuple", ["list"], ({ list }) => `[${list.map((inner) => inner.toString()).join(", ")}]`);
defineMethod("object", ["dict"], ({ dict }) => {
	if (Object.keys(dict).length === 0) return "{}";
	return `{ ${Object.entries(dict).map(([key, inner]) => {
		return `${key}${inner.meta.required ? "" : "?"}: ${inner.toString()}`;
	}).join(", ")} }`;
});
defineMethod("union", ["list"], ({ list }, inline) => {
	const result = list.map(({ toString: format }) => format()).join(" | ");
	return inline ? `(${result})` : result;
});
defineMethod("intersect", ["list"], ({ list }) => {
	return `${list.map((inner) => inner.toString(true)).join(" & ")}`;
});
defineMethod("transform", [
	"inner",
	"callback",
	"preserve"
], ({ inner }, isInner) => inner.toString(isInner));
//#endregion
//#region src/config.ts
/**
* The plugin's deployment tunables. Every value a deployment may reasonably
* change is a validated Config field, so a profile patch overrides it without
* editing this package.
*
* @module @local/dsh-updater/config
*/
const Config$1 = Schema.object({
	repoRoot: Schema.string(),
	remote: Schema.string().default("origin"),
	branch: Schema.string().default("master"),
	build: Schema.union(["full", "lib-web"]).default("full"),
	autoCheck: Schema.union([
		"startup",
		"daily",
		"weekly",
		"monthly",
		"never"
	]).default("startup"),
	pnpmCommand: Schema.string().default("pnpm"),
	timeoutMs: Schema.number().default(12e5),
	probeTimeoutMs: Schema.number().default(6e4),
	logTailBytes: Schema.number().default(65536),
	maxDirtyFiles: Schema.number().default(50)
});
/**
* Project the effective configuration onto the fields the Settings page shows.
* @param config - Resolved plugin configuration.
* @returns The browser-visible subset.
*/
function configView(config) {
	return {
		remote: config.remote,
		branch: config.branch,
		build: config.build,
		autoCheck: config.autoCheck
	};
}
/** Milliseconds between unattended probes, or `undefined` when never probed automatically. */
const CADENCE_MILLISECONDS = {
	startup: 0,
	daily: 1440 * 60 * 1e3,
	weekly: 10080 * 60 * 1e3,
	monthly: 720 * 60 * 60 * 1e3,
	never: void 0
};
/**
* Decide whether an unattended probe is due now.
*
* A `startup` cadence is due once per process start, which the caller tracks
* by passing whether this process already probed; every other cadence is due
* when the recorded instant is older than its interval.
* @param frequency - Configured cadence.
* @param lastCheckedAt - ISO-8601 instant of the last recorded probe, when one exists.
* @param alreadyProbedThisProcess - Whether this process already ran an unattended probe.
* @param now - Current instant, injectable for tests.
* @returns Whether the caller should probe.
*/
function isCheckDue(frequency, lastCheckedAt, alreadyProbedThisProcess, now = Date.now()) {
	const interval = CADENCE_MILLISECONDS[frequency];
	if (interval === void 0) return false;
	if (interval === 0) return !alreadyProbedThisProcess;
	if (lastCheckedAt === void 0) return true;
	const previous = Date.parse(lastCheckedAt);
	if (Number.isNaN(previous)) return true;
	return now - previous >= interval;
}
//#endregion
//#region src/resolve-install.ts
/**
* Resolves which DeepSeek Harness source checkout this process runs from, so
* the Updater works from any installation path. The plugin's configured root
* wins; otherwise the profile's install anchor is walked upward to the root.
* A candidate is accepted only when it proves itself a DSH checkout:
* `<root>/package.json` names `@deepseek-ai/dsh-root` and `<root>/.git` exists.
* @module @local/dsh-updater/resolve-install
*/
/** `name` carried by the root manifest of a DeepSeek Harness source checkout. */
const ROOT_MANIFEST_NAME = "@deepseek-ai/dsh-root";
/**
* Parent levels inspected above a profile install anchor. A packaged install
* anchors one level below its root and a source checkout three, so the limit
* only bounds the search; the manifest name decides the hit.
*/
const MAX_ANCHOR_LEVELS = 4;
/**
* Resolve the checkout the running Harness belongs to.
*
* Accepted candidates must carry a `@deepseek-ai/dsh-root` manifest and a
* `.git` entry, so a directory that merely resembles a checkout is refused
* with the concrete failing fact rather than updated by mistake.
* @param options - Configured root and profile install anchor, in priority order.
* @returns The resolved location, or a display-safe reason no checkout was found.
*/
async function resolveInstallLocation(options) {
	const candidate = await candidateRoot(options);
	if (!candidate.ok) return {
		ok: false,
		reason: candidate.reason
	};
	const manifest = await readRootManifest(candidate.root);
	if (manifest.kind === "error") return {
		ok: false,
		reason: manifest.reason
	};
	const gitReason = await gitEntryFailure(candidate.root);
	if (gitReason !== void 0) return {
		ok: false,
		reason: gitReason
	};
	return {
		ok: true,
		location: {
			root: candidate.root,
			anchor: candidate.anchor
		}
	};
}
/**
* Pick the directory to validate from the two configured sources.
* @param options - Configured root and profile install anchor.
* @returns The candidate root and the manifest it was derived from, or the reason neither source was available.
*/
async function candidateRoot(options) {
	const configuredRoot = options.configuredRoot?.trim() ?? "";
	if (configuredRoot !== "") {
		const root = path.resolve(configuredRoot);
		return {
			ok: true,
			root,
			anchor: manifestPath(root)
		};
	}
	const installAnchor = options.installAnchor?.trim() ?? "";
	if (installAnchor !== "") return anchoredRoot(path.resolve(installAnchor));
	return {
		ok: false,
		reason: "no checkout root configured and no profile install anchor available; set the updater's root option in cordis.yml or start dsh from a source checkout"
	};
}
/**
* Walk up from a profile install anchor to the checkout root.
*
* The anchor is the installation's own app manifest, and its distance from the
* checkout root depends on the layout: a packaged install keeps it at
* `<installDir>/runtime/package.json`, while a source checkout keeps it at
* `<checkout>/apps/cli/package.json`. The walk therefore tests each parent
* directory instead of trusting a fixed level count, and stops at the first
* directory whose manifest names the DSH root package.
* @param anchor - Absolute path of the installation's app manifest.
* @returns The checkout root and the anchor it was derived from, or a reason listing the directories inspected.
*/
async function anchoredRoot(anchor) {
	const inspected = [];
	let dir = path.dirname(anchor);
	for (let level = 0; level < MAX_ANCHOR_LEVELS; level += 1) {
		inspected.push(dir);
		if ((await readRootManifest(dir)).kind === "ok") return {
			ok: true,
			root: dir,
			anchor
		};
		const parent = path.dirname(dir);
		if (parent === dir) break;
		dir = parent;
	}
	return {
		ok: false,
		reason: `no DeepSeek Harness checkout root found from ${anchor} upward; inspected ${inspected.join(", ")} — the root holds a package.json named "${ROOT_MANIFEST_NAME}"`
	};
}
/**
* Check the root manifest.
* @param root - Candidate checkout root.
* @returns `ok` when the manifest proves the checkout, otherwise the display-safe reason it does not.
*/
async function readRootManifest(root) {
	const manifest = manifestPath(root);
	let text;
	try {
		text = await readFile(manifest, "utf8");
	} catch (error) {
		return {
			kind: "error",
			reason: hasErrnoCode(error, "ENOENT") ? `${manifest} does not exist` : `cannot read ${manifest}: ${describeError(error)}`
		};
	}
	let parsed;
	try {
		parsed = JSON.parse(text);
	} catch (error) {
		return {
			kind: "error",
			reason: `${manifest} is not valid JSON: ${describeError(error)}`
		};
	}
	const name = manifestName(parsed);
	if (name === ROOT_MANIFEST_NAME) return { kind: "ok" };
	return {
		kind: "error",
		reason: name === void 0 ? `${manifest} declares no "name"; expected "${ROOT_MANIFEST_NAME}"` : `${manifest} declares name "${name}"; expected "${ROOT_MANIFEST_NAME}"`
	};
}
/**
* Check for the git entry.
* @param root - Candidate checkout root.
* @returns `undefined` when `<root>/.git` exists (a directory or a worktree's file), otherwise the reason it is missing.
*/
async function gitEntryFailure(root) {
	const entry = path.join(root, ".git");
	try {
		await stat(entry);
		return;
	} catch (error) {
		return hasErrnoCode(error, "ENOENT") ? `${root} is not a git checkout: ${entry} does not exist` : `cannot inspect ${entry}: ${describeError(error)}`;
	}
}
/**
* Read the `name` field of a parsed manifest.
* @param parsed - Value produced by `JSON.parse`; any JSON type is possible.
* @returns The declared name, or `undefined` when absent or not a string.
*/
function manifestName(parsed) {
	if (typeof parsed !== "object" || parsed === null || !("name" in parsed)) return void 0;
	const name = parsed.name;
	return typeof name === "string" ? name : void 0;
}
/**
* Path of the root manifest of one candidate root.
* @param root - Candidate checkout root.
* @returns The absolute manifest path.
*/
function manifestPath(root) {
	return path.join(root, "package.json");
}
/**
* Render one caught value for a user-facing reason.
* @param error - Caught value of unknown type.
* @returns The error message, or the stringified value when it is not an `Error`.
*/
function describeError(error) {
	return error instanceof Error ? error.message : String(error);
}
/**
* Test one caught value for a Node errno code.
* @param error - Caught value of unknown type.
* @param code - Errno code to match, such as `ENOENT`.
* @returns `true` when the value carries that code.
*/
function hasErrnoCode(error, code) {
	if (typeof error !== "object" || error === null || !("code" in error)) return false;
	return error.code === code;
}
//#endregion
//#region src/routes.ts
/** Path prefix every updater route hangs under. */
const UPDATER_ROUTE_PREFIX = "/dsh-updater";
/** Upper bound on a request body this surface accepts, in bytes. */
const MAX_REQUEST_BYTES = 64 * 1024;
/** A refusal the browser half renders from its stable code. */
var UpdaterRequestError = class extends Error {
	code;
	/**
	* @param code - Machine-readable cause sent on the wire.
	* @param message - Human-readable explanation, safe to display.
	*/
	constructor(code, message) {
		super(message);
		this.code = code;
		this.name = "UpdaterRequestError";
	}
};
/** HTTP status each wire code is answered with. */
const CODE_STATUS = {
	unavailable: 409,
	busy: 409,
	dirty: 409,
	"no-run": 404,
	"invalid-request": 400,
	internal: 500
};
/** Write one JSON response and end it. */
function sendJson(response, status, body) {
	const payload = JSON.stringify(body);
	response.writeHead(status, {
		"content-type": "application/json; charset=utf-8",
		"content-length": Buffer.byteLength(payload),
		"cache-control": "no-store"
	});
	response.end(payload);
}
/** Read the whole request body, refusing anything past the cap. */
async function readBody(request) {
	const chunks = [];
	let total = 0;
	for await (const chunk of request) {
		const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
		total += buffer.byteLength;
		if (total > MAX_REQUEST_BYTES) throw new UpdaterRequestError("invalid-request", "Request body is too large");
		chunks.push(buffer);
	}
	return Buffer.concat(chunks).toString("utf8");
}
/** Parse a JSON request body into a partial tunable update. */
function parseConfigPatch(text) {
	let parsed;
	try {
		parsed = text.trim() === "" ? {} : JSON.parse(text);
	} catch {
		throw new UpdaterRequestError("invalid-request", "Request body is not valid JSON");
	}
	if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new UpdaterRequestError("invalid-request", "Request body must be a JSON object");
	const record = parsed;
	const patch = {};
	if (record.remote !== void 0) {
		if (typeof record.remote !== "string" || record.remote.trim() === "") throw new UpdaterRequestError("invalid-request", "remote must be a non-empty string");
		patch.remote = record.remote;
	}
	if (record.branch !== void 0) {
		if (typeof record.branch !== "string" || record.branch.trim() === "") throw new UpdaterRequestError("invalid-request", "branch must be a non-empty string");
		patch.branch = record.branch;
	}
	if (record.build !== void 0) {
		if (record.build !== "full" && record.build !== "lib-web") throw new UpdaterRequestError("invalid-request", "build must be \"full\" or \"lib-web\"");
		patch.build = record.build;
	}
	if (record.autoCheck !== void 0) {
		const found = [
			"startup",
			"daily",
			"weekly",
			"monthly",
			"never"
		].find((frequency) => frequency === record.autoCheck);
		if (found === void 0) throw new UpdaterRequestError("invalid-request", "autoCheck must be one of startup, daily, weekly, monthly, never");
		patch.autoCheck = found;
	}
	return patch;
}
/** Turn any thrown value into the wire envelope and status. */
function failureBody(error) {
	if (error instanceof UpdaterRequestError) return {
		status: CODE_STATUS[error.code],
		body: {
			code: error.code,
			message: error.message
		}
	};
	const message = error instanceof Error ? error.message : String(error);
	return {
		status: CODE_STATUS.internal,
		body: {
			code: "internal",
			message
		}
	};
}
/**
* Build the route handler registered on `webServer`.
*
* The handler owns its full response lifecycle, never throws, and answers
* every request with either an {@link UpdaterStatus} document or an
* {@link UpdaterErrorBody} envelope.
* @param dependencies - The domain operations plus the trust fence.
* @returns A node:http handler bound to {@link UPDATER_ROUTE_PREFIX}.
*/
function createUpdaterHandler(dependencies) {
	const { api, refuse } = dependencies;
	return async (request, response) => {
		try {
			const url = new URL(request.url ?? "/", "http://localhost");
			if (url.pathname !== "/dsh-updater" && !url.pathname.startsWith(`/dsh-updater/`)) {
				sendJson(response, 404, {
					code: "invalid-request",
					message: `Unknown route ${url.pathname}`
				});
				return;
			}
			const refused = refuse(request.headers);
			if (refused !== void 0) {
				sendJson(response, refused, {
					code: "invalid-request",
					message: "Request refused by the browser-trust fence"
				});
				return;
			}
			const action = url.pathname.slice(12).replace(/^\/+|\/+$/gu, "");
			const method = request.method ?? "GET";
			if (action === "status" && method === "GET") {
				sendJson(response, 200, await api.status());
				return;
			}
			if (action === "check" && method === "POST") {
				sendJson(response, 200, await api.check());
				return;
			}
			if (action === "update" && method === "POST") {
				sendJson(response, 200, await api.update());
				return;
			}
			if (action === "rollback" && method === "POST") {
				sendJson(response, 200, await api.rollback());
				return;
			}
			if (action === "config" && method === "PUT") {
				sendJson(response, 200, await api.patchConfig(parseConfigPatch(await readBody(request))));
				return;
			}
			sendJson(response, 404, {
				code: "invalid-request",
				message: `${method} ${url.pathname} is not an updater route`
			});
		} catch (error) {
			const { status, body } = failureBody(error);
			sendJson(response, status, body);
		}
	};
}
//#endregion
//#region src/runner.ts
/**
* Parent-process half of the update pipeline: it takes the run lock, records
* the run, and starts the detached subprocess that performs the merge, the
* reinstall, the rebuild, and any rollback. The subprocess outlives this
* process on purpose, so a Harness restart cannot interrupt an update; the
* durable run record, not the child, is what callers read afterwards.
*
* @module @local/dsh-updater/runner
*/
/** Built entry of the update subprocess, resolved next to this module's artifact. */
const RUNNER_ENTRY = fileURLToPath(new URL("./update-runner.js", import.meta.url));
/** Run logs the state directory keeps; older ones are pruned after a start. */
const LOG_RETENTION = 20;
/**
* Launch one update run in a detached subprocess and return the run record as
* written before that subprocess started.
*
* The lock is taken first, so two runs can never drive the same checkout at
* once. Once the subprocess exists, this function only reports: progress,
* failure, and rollback all reach the caller through the durable record.
*
* @param options Checkout, state paths, and update parameters of the run.
* @returns The `'preflight'` record the subprocess continues from.
* @throws When another run holds the lock, or when the run cannot be recorded
* or started — in which case the lock is released again.
*/
async function startUpdate(options) {
	const { paths } = options;
	if (!await acquireRunLock(paths)) throw new Error(`another update run already holds ${paths.lockFile}`);
	const run = {
		runId: newRunId(/* @__PURE__ */ new Date(), randomUUID().replaceAll("-", "").slice(0, 6)),
		phase: "preflight",
		startedAt: (/* @__PURE__ */ new Date()).toISOString(),
		beforeSha: options.beforeSha
	};
	const base = {
		runId: run.runId,
		root: options.root,
		paths,
		beforeSha: options.beforeSha,
		remote: options.remote,
		branch: options.branch,
		build: options.build,
		pnpmCommand: options.pnpmCommand
	};
	await launchRunner(paths, run, options.mode === void 0 ? base : {
		...base,
		mode: options.mode
	});
	try {
		await pruneLogs(paths, LOG_RETENTION);
	} catch (error) {
		console.error(`dsh-updater: could not prune old update logs: ${describeError$1(error)}`);
	}
	return run;
}
/**
* Record the run and start the detached subprocess with the run log as its
* standard output and standard error.
*
* A launch that fails before the subprocess exists leaves nothing to report the
* failure, so the lock is released here and the caller's error stands; a
* subprocess that fails later reports itself through the durable record.
*
* @param paths Persistent state paths.
* @param run Record the subprocess continues from.
* @param config Configuration passed as the subprocess's only argument.
* @returns The started child process.
*/
async function launchRunner(paths, run, config) {
	let logFd;
	try {
		const logPath = await newRunLogPath(paths, run.runId);
		await writeRun(paths, run);
		logFd = openSync(logPath, "a");
		const child = spawn(process.execPath, [RUNNER_ENTRY, JSON.stringify(config)], {
			cwd: config.root,
			detached: true,
			stdio: [
				"ignore",
				logFd,
				logFd
			],
			windowsHide: true
		});
		child.on("error", (error) => {
			recordSpawnFailure(paths, run, logPath, error);
		});
		child.unref();
		return child;
	} catch (error) {
		await releaseQuietly(paths);
		throw error;
	} finally {
		if (logFd !== void 0) closeSync(logFd);
	}
}
/**
* Record a launch failure the subprocess could not report, then free the lock.
* The child never started, so no other writer competes for the record.
* @param paths Persistent state paths.
* @param run Record written before the launch attempt.
* @param logPath Absolute path of the run log.
* @param error Failure the child process emitted instead of starting.
*/
async function recordSpawnFailure(paths, run, logPath, error) {
	const failure = {
		phase: "preflight",
		message: `the update subprocess could not be started: ${describeError$1(error)}`,
		exitCode: null,
		stderrTail: appendTail("", describeErrorDetail(error), STDERR_TAIL_BYTES),
		logPath
	};
	try {
		await appendLog(logPath, `[failed] ${failure.message}\n`);
		await writeRun(paths, {
			...run,
			phase: "failed",
			failure,
			finishedAt: (/* @__PURE__ */ new Date()).toISOString()
		});
	} catch (writeError) {
		console.error(`dsh-updater: could not record the failed launch of run ${run.runId}: ${describeError$1(writeError)}`);
	}
	await releaseQuietly(paths);
}
/**
* Release the run lock, reporting a failure instead of masking the error of the
* caller that was already handling something worse.
* @param paths Persistent state paths.
*/
async function releaseQuietly(paths) {
	try {
		await releaseRunLock(paths);
	} catch (error) {
		console.error(`dsh-updater: could not release the run lock ${paths.lockFile}: ${describeError$1(error)}`);
	}
}
//#endregion
//#region src/index.ts
/**
* Host half of the Updater. It resolves the running checkout, exposes the
* update operations over an HTTP surface the Settings page calls, and probes
* the remote on the configured cadence. Every actual update runs in a
* detached subprocess, so an in-flight update survives a Host reload or
* restart and this plugin owns only launch, observation, and reporting.
*
* @module @local/dsh-updater
*/
/** Cordis plugin name. */
const name = "dsh-updater";
/** Services that must exist for the plugin to activate at all. */
const inject = ["webServer"];
/** The profile entry id this plugin's tunables are written back to. */
const ENTRY_ID = "dsh-updater";
/** Attempts one probe makes before its failure is reported. */
const PROBE_ATTEMPTS = 3;
/** Delay between probe attempts, in milliseconds. */
const PROBE_RETRY_DELAY_MS = 2e3;
/** Appended when a probe ran out of attempts while the remote was unreachable. */
const PROBE_TIMEOUT_HINT = "The remote host is unreachable or very slow; check network access to it, or raise probeTimeoutMs.";
/** Validated configuration schema, exported as the plugin's Cordis `Config`. */
const Config = Config$1;
/**
* Instant this process started, in epoch milliseconds.
*
* Derived from `process.uptime()` rather than captured when `apply` runs, so a
* plugin reload inside a long-lived process does not move it: the question it
* answers is about the process, not about this activation.
*/
const PROCESS_STARTED_AT = Date.now() - process.uptime() * 1e3;
/**
* Whether a completed update is still waiting for a Host restart.
*
* A successful run is recorded permanently, so its phase cannot answer this on
* its own — reporting every recorded `done` as pending would keep asking for a
* restart that has already happened and would change nothing. The comparison is
* therefore against this process's own start: a run that finished before it is
* already the code being served.
* @param run - Recorded run, when the checkout has one.
* @param processStartedAt - Epoch milliseconds the current process started.
* @returns true only while a finished update has not been picked up yet.
*/
function isRestartPending(run, processStartedAt = PROCESS_STARTED_AT) {
	if (run === void 0 || run.phase !== "done") return false;
	const finishedAt = run.finishedAt;
	if (finishedAt === void 0) return false;
	const finished = Date.parse(finishedAt);
	return Number.isFinite(finished) && finished > processStartedAt;
}
/**
* The Harness home this process uses.
* @param ctx - Plugin context, which carries the launcher-owned locations in a profile.
* @returns Absolute Harness home.
*/
function harnessHome(ctx) {
	const profileContext = ctx.get("profileContext");
	if (profileContext !== void 0) return profileContext.home;
	return process.env.DSH_HOME ?? join(homedir(), ".dsh");
}
/**
* Resolve the updatable checkout once per activation. A failed resolution is
* cached too: it describes this installation, and retrying on every page load
* would only repeat the same answer.
* @param ctx - Plugin context.
* @param config - Resolved configuration.
* @returns A memoized resolver.
*/
function runtimeOnce(ctx, config) {
	let pending;
	return () => {
		pending ??= (async () => {
			const profileContext = ctx.get("profileContext");
			const install = await resolveInstallLocation({
				configuredRoot: config.repoRoot,
				installAnchor: profileContext?.installAnchor
			});
			if (!install.ok) return {
				runtime: void 0,
				reason: install.reason
			};
			const paths = updaterPaths(harnessHome(ctx));
			return { runtime: {
				location: install.location,
				paths,
				store: openCheckRecordStore(paths),
				root: install.location.root
			} };
		})();
		return pending;
	};
}
/**
* Reuse the connection carrier's browser-trust fence for this surface too.
* @param ctx - Plugin context.
* @param headers - Raw request headers.
* @returns The refusal status, or `undefined` to proceed.
*/
function refuse(ctx, headers) {
	const connection = ctx.get("connection");
	if (connection === void 0) return void 0;
	return connection.requestRejection({ headers });
}
/**
* Describe why a probe gave up after every attempt failed.
* @param error - Message the last attempt reported.
* @param attempts - How many attempts were made.
* @returns The cause to record, with guidance when the remote looked unreachable.
*/
function probeFailureDetail(error, attempts) {
	return `${error} (gave up after ${attempts} ${attempts === 1 ? "attempt" : "attempts"}).${/timed?\s?out|timeout/iu.test(error) ? ` ${PROBE_TIMEOUT_HINT}` : ""}`;
}
/**
* Probe the remote without touching the checkout.
*
* One attempt is not enough on a link that drops connections intermittently: a
* probe that fails once and succeeds on the next says nothing different about
* the checkout, so earlier attempts stay in the log and only the last failure
* is reported to the page.
* @param ctx - Plugin context, used for retry diagnostics.
* @param root - Checkout root.
* @param config - Resolved configuration.
* @returns The probe outcome, including its failure form.
*/
async function probe(ctx, root, config) {
	const facts = await repoFacts(root, { timeoutMs: config.probeTimeoutMs });
	const checkedAt = (/* @__PURE__ */ new Date()).toISOString();
	let lastError = "";
	for (let attempt = 1; attempt <= PROBE_ATTEMPTS; attempt += 1) try {
		const upstream = await remoteHead(root, config.remote, config.branch, { timeoutMs: config.probeTimeoutMs });
		if (upstream === void 0) return {
			checkedAt,
			localSha: facts.head,
			upstreamSha: facts.head,
			updateAvailable: false,
			error: `Remote branch ${config.remote}/${config.branch} was not found`
		};
		return {
			checkedAt,
			localSha: facts.head,
			upstreamSha: upstream,
			updateAvailable: upstream !== facts.head
		};
	} catch (error) {
		lastError = error instanceof Error ? error.message : String(error);
		if (attempt < PROBE_ATTEMPTS) {
			ctx.logger.warn(`dsh-updater: probe attempt ${attempt}/${PROBE_ATTEMPTS} failed, retrying: ${lastError}`);
			await setTimeout(PROBE_RETRY_DELAY_MS);
		}
	}
	return {
		checkedAt,
		localSha: facts.head,
		upstreamSha: facts.head,
		updateAvailable: false,
		error: probeFailureDetail(lastError, PROBE_ATTEMPTS)
	};
}
/**
* Build the browser-visible projection. Every field is read fresh so a page
* polling during a run observes each phase without a separate endpoint.
* @param ctx - Plugin context.
* @param config - Resolved configuration.
* @param resolveRuntime - Memoized runtime resolution.
* @returns The complete status document.
*/
async function buildStatus(ctx, config, resolveRuntime) {
	const view = configView(config);
	const resolved = await resolveRuntime();
	if (resolved.runtime === void 0) return {
		available: false,
		unavailableReason: resolved.reason,
		config: view
	};
	const { location, paths, store, root } = resolved.runtime;
	const [repo, check, run] = await Promise.all([
		repoFacts(root).catch((error) => {
			ctx.logger.warn(`dsh-updater: reading repository facts failed: ${String(error)}`);
		}),
		store.read(),
		readRun(paths)
	]);
	const logTail = run === void 0 ? void 0 : await readLogTail(await newRunLogPath(paths, run.runId), config.logTailBytes);
	return {
		available: true,
		location,
		config: view,
		restartPending: isRestartPending(run),
		...repo === void 0 ? {} : { repo },
		...check === void 0 ? {} : { check },
		...run === void 0 ? {} : { run },
		...logTail === void 0 || logTail === "" ? {} : { logTail }
	};
}
/**
* Mount the updater: one HTTP surface, one memoized checkout resolution, and
* one unattended probe per activation when the cadence calls for it.
* @param ctx - Host plugin context.
* @param config - Validated plugin configuration.
*/
function apply(ctx, config) {
	const resolveRuntime = runtimeOnce(ctx, config);
	const requireRuntime = async () => {
		const resolved = await resolveRuntime();
		if (resolved.runtime === void 0) throw new UpdaterRequestError("unavailable", resolved.reason);
		return resolved.runtime;
	};
	const api = {
		status: () => buildStatus(ctx, config, resolveRuntime),
		check: async () => {
			const { root, store } = await requireRuntime();
			const result = await probe(ctx, root, config);
			await store.write(result);
			return await buildStatus(ctx, config, resolveRuntime);
		},
		update: async () => {
			const { root, paths } = await requireRuntime();
			if (await isRunActive(paths)) throw new UpdaterRequestError("busy", "An update is already running");
			const facts = await repoFacts(root);
			if (facts.dirty) throw new UpdaterRequestError("dirty", `The checkout has uncommitted changes; commit or stash them first:\n${facts.dirtyFiles.slice(0, config.maxDirtyFiles).join("\n")}`);
			await startUpdate({
				root,
				paths,
				beforeSha: facts.head,
				remote: config.remote,
				branch: config.branch,
				build: config.build,
				pnpmCommand: config.pnpmCommand,
				mode: "update"
			});
			return await buildStatus(ctx, config, resolveRuntime);
		},
		rollback: async () => {
			const { root, paths } = await requireRuntime();
			if (await isRunActive(paths)) throw new UpdaterRequestError("busy", "An update is already running");
			const previous = await readRun(paths);
			if (previous === void 0) throw new UpdaterRequestError("no-run", "No recorded update run to roll back");
			await startUpdate({
				root,
				paths,
				beforeSha: previous.beforeSha,
				remote: config.remote,
				branch: config.branch,
				build: config.build,
				pnpmCommand: config.pnpmCommand,
				mode: "rollback"
			});
			return await buildStatus(ctx, config, resolveRuntime);
		},
		patchConfig: async (patch) => {
			const editor = ctx.get("configEditor");
			if (editor === void 0) throw new UpdaterRequestError("unavailable", "This profile mounts no configuration editor");
			const entry = editor.entries().find((candidate) => candidate.options.id === ENTRY_ID);
			if (entry === void 0) throw new UpdaterRequestError("unavailable", `Profile entry ${ENTRY_ID} is not addressable`);
			await editor.edit(entry, (current) => ({
				...current,
				...patch
			}));
			return await buildStatus(ctx, config, resolveRuntime);
		}
	};
	ctx.effect(() => ctx.webServer.register({
		kind: "prefix",
		path: UPDATER_ROUTE_PREFIX,
		handler: createUpdaterHandler({
			api,
			refuse: (headers) => refuse(ctx, headers)
		})
	}), "dsh-updater: browser surface");
	ctx.effect(() => {
		const controller = new AbortController();
		(async () => {
			if (controller.signal.aborted) return;
			const resolved = await resolveRuntime();
			if (resolved.runtime === void 0 || controller.signal.aborted) return;
			const { root, store } = resolved.runtime;
			const previous = await store.read();
			if (!isCheckDue(config.autoCheck, previous?.checkedAt, false)) return;
			const result = await probe(ctx, root, config);
			await store.write(result);
			ctx.logger.info(`dsh-updater: ${result.updateAvailable ? "an update is available" : "the checkout is current"}`);
		})().catch((error) => {
			ctx.logger.warn(`dsh-updater: the unattended probe failed: ${String(error)}`);
		});
		return () => controller.abort();
	}, "dsh-updater: unattended probe");
}
//#endregion
export { Config, apply, inject, isRestartPending, name, probeFailureDetail };
