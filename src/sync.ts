/// <reference path="../interfaces/moss.d.ts" />

import {
    map as map, okmap as okmapSync, okmap, arrayify, extend,
    check, clone, each, setValueForKeyPath, sum, valueForKeyPath,
    all, isEqual, mergeArray, mergeOrReturnAssignment, contains
} from 'typed-json-transform';
import { interpolate as __interpolate, reservedKeys } from './interpolate';
import { cascade as _cascade, shouldConstruct, select, parseSelectors } from './cascade';
import * as yaml from 'js-yaml';

import { getBranchSync as getBranch } from './resolvers';
import { parseDescription } from './schema';

import {
    newLayer,
    pushState,
    currentErrorPath,
    pushErrorPath,
    popErrorPath
} from './state';

import { handleError } from './util'

export namespace Sync {
    type Functions = Moss.Sync.Functions;
    type Resolvers = Moss.Sync.Resolvers;

    export const continueWithNewFrame = (current: Moss.ReturnValue, input: Moss.BranchData) => {
        const layer = pushState(current);
        return parseNextStructure(layer, input);
    }

    export const next = continueWithNewFrame;

    export const parseObject = (current: Moss.ReturnValue) => {
        const { state } = current;
        const source: any = clone(current.data);
        const target = state.target || current.data;

        let res;
        for (const _key of Object.keys(source)) {
            if (!_key) {
                continue;
            }
            delete target[_key];
            let key = '';
            currentErrorPath(state).path.push(_key);
            if (_key[_key.length - 1] === '>') {
                key = _key.slice(0, _key.length - 1);
                res = source[_key];
            }
            else {
                if (_key[_key.length - 1] === '<') {
                    const fn = _key.slice(0, key.length - 1);
                    if (functions[fn]) {
                        functions[fn](current, source[_key]);
                    } else {
                        throw ({
                            message: `no known function ${fn}`,
                            errorPaths: state.errorPaths
                        });
                    }
                } else if (_key[0] === '<') {
                    const operator = _key[1];
                    const { selectors } = parseSelectors(state.selectors);
                    const precedence = select(selectors, _key.slice(2));
                    if (target != current.data) throw ({ message: 'not targeting current object...' });
                    if (precedence > (state.merge.precedence[operator] || 0)) {
                        state.merge.precedence[operator] = precedence;
                        key = _key[0] + _key[1];
                        res = (continueWithNewFrame(current, source[_key])).data;
                    }
                } else {
                    let val = source[_key];
                    if (_key[0] === '$') {
                        if (!contains(reservedKeys, _key)) {
                            key = <any>(interpolate(current, _key)).data;
                        } else {
                            key = _key;
                        }
                        // } else if (_key.indexOf('.') != -1) {
                        //     const [first, ...kp] = _key.split('.')
                        //     key = first;
                        //     val = {};
                        //     setValueForKeyPath(source[_key], kp.join('.'), val);
                    } else {
                        key = _key;
                    }
                    res = (continueWithNewFrame(current, val)).data;
                }
            }
            if (key) {
                state.auto[key] = res;
                state.autoMap[key] = currentErrorPath(state).path.join('.');
                target[key] = res;
            }
            currentErrorPath(state).path.pop();
        }
        if (current.state.schema) {
            // check
        }
        return current;
    }

    export const parseArray = (layer: Moss.ReturnValue, input: Moss.BranchData) => {
        const { state } = layer;
        return {
            data: map(input, (item: any, index) => {
                currentErrorPath(state).path.push(`${index}`);
                const res: Moss.ReturnValue = (continueWithNewFrame({ data: input, state }, item)).data
                currentErrorPath(state).path.pop();
                return res;
            }), state
        };
    }

    export const parseNextStructure = (layer: Moss.ReturnValue, input: Moss.BranchData) => {
        const { state } = layer;
        try {
            if (check(input, Array)) {
                return parseArray(layer, input);
            }
            else if (check(input, Object)) {
                if (shouldConstruct(input)) {
                    return cascade({ data: input, state });
                }
                return parseObject({ data: input, state });
            } else {
                return interpolate(layer, input);
            }
        } catch (e) { handleError(e, layer, input) }
    }

    export const onMatch = (rv: Moss.ReturnValue, setter: any, operator: Merge.Operator, key: string) => {
        let { state, data: lhs } = rv;
        currentErrorPath(state).path.push(key);
        state.merge.operator = operator;
        const rhs = (continueWithNewFrame({ data: {}, state }, setter)).data;
        if (check(lhs, Array)) {
            mergeArray(rv, rhs)
        } else if (check(lhs, Object)) {
            mergeOrReturnAssignment(rv, rhs)
        } else {
            rv.data = rhs;
        }
        currentErrorPath(state).path.pop();
    }

    const constructOperators: Merge.Operator[] = ['=', '+', '-'];
    const mergeOperators: Merge.Operator[] = ['=', '+', '|', '^', '*', '&', '-', '?'];

    export const cascade = (rv: Moss.ReturnValue) => {
        const input = clone(rv.data);
        rv.data = null;
        for (const operator of constructOperators) {
            _cascade(rv, input, {
                operator,
                usePrecedence: (operator == '='),
                onMatch
            });
        };
        return rv;
    }

    const functions: Functions = {}
    const resolvers: Resolvers = {}

    export function getFunctions() {
        return functions;
    }

    export function addFunctions(userFunctions: Functions) {
        extend(functions, userFunctions);
    }

    export function getResolvers() {
        return resolvers;
    }

    export function addResolvers(userResolvers: Resolvers) {
        extend(resolvers, userResolvers);
    }

    addResolvers({
        hello: {
            match: (uri: string) => uri == 'hello',
            resolve: (uri: string) => ({
                path: uri,
                data: 'world!'
            })
        }
    });

    addFunctions({
        select: (current: Moss.ReturnValue, args: any) => {
            const { data, state: _state } = current;
            const state = clone(_state);
            state.locked = true;
            state.target = state.selectors;
            parseNextStructure({
                data,
                state,
            }, args);
            _state.selectors = state.selectors;
        },
        stack: (current: Moss.ReturnValue, args: any) => {
            const { data, state: _state } = current;
            const state = clone(_state);
            state.locked = true;
            state.target = state.stack;
            parseNextStructure({
                data,
                state,
            }, args);
            _state.stack = state.stack;
        },
        $: (current: Moss.ReturnValue, args: any) => {
            parseNextStructure(current, args);
        },
        schema: (current: Moss.ReturnValue, args: any) => {
            const description = continueWithNewFrame(current, args);
            current.state.schema = parseDescription(description.data);
            console.log(current.state.schema);
            current.data = current.state.schema;
        },
        extend: (parent: Moss.ReturnValue, args: any) => {
            const layer = continueWithNewFrame(parent, args);
            const { data } = layer;
            if (!data.source) {
                throw ({
                    message: `for $extend please supply an 'source:' branch`,
                    errorPaths: layer.state.errorPaths
                });
            }
            let res = data.source;
            delete data.source;
            for (const i in data) {
                const ir = continueWithNewFrame(layer, data[i]);
                res = extend(res, ir.data);
            };
            return res;
        },
        log: (current: Moss.ReturnValue, args: any) => {
            each(arrayify(args), (i) => {
                let kp = i;
                let format = 'json';
                if (check(i, Object)) {
                    kp = i.keyPath;
                    format = i.format;
                }
                const val = kp ? valueForKeyPath(kp, current) : current;
                switch (format) {
                    case 'json': console.log(JSON.stringify(val, null, 2)); break;
                    case 'yaml': console.log(yaml.dump(val)); break;
                }
            });
        },
        assert: (parent: Moss.ReturnValue, args: any) => {
            throw ({
                message: args,
                errorPaths: parent.state.errorPaths,
                source: args
            });
        },
        each: (parent: Moss.ReturnValue, args: any) => {
            const layer = continueWithNewFrame(parent, args);
            const { data } = layer;
            if (!data.of) {
                throw ({
                    message: `for $each please supply an 'of:' branch`,
                    errorPaths: layer.state.errorPaths,
                    source: data
                });
            }
            if (!data.do) {
                throw ({
                    message: `for $each please supply a 'do:' branch`,
                    errorPaths: layer.state.errorPaths,
                    source: data
                });
            }
            let i = 0;
            for (const key in data.of) {
                const item = data.of[key];
                const ret = continueWithNewFrame(layer, item);
                ret.state.auto.index = i;
                i++;
                continueWithNewFrame(ret, clone(data.do));
            };
        },
        map: (parent: Moss.ReturnValue, args: any) => {
            const base = currentErrorPath(parent.state).path.join('.');
            const { from, to } = args;
            if (!from) {
                throw ({
                    message: `for $map please supply 'from:' as input`,
                    errorPaths: parent.state.errorPaths,
                });
            }
            currentErrorPath(parent.state).path.push('from');
            const fromCtx = continueWithNewFrame(parent, from);
            currentErrorPath(fromCtx.state).path.pop();
            if (!to) {
                throw ({
                    message: `for $map please supply 'to:' as input`,
                    errorPaths: fromCtx.state.errorPaths,
                    source: args
                });
            }
            let i = 0;
            parent.data = okmap(fromCtx.data, (item: any, key: string) => {
                if (fromCtx.state.autoMap[key]) {
                    currentErrorPath(fromCtx.state).path = fromCtx.state.autoMap[key].split('.');
                }
                const ctx = continueWithNewFrame(fromCtx, item);
                currentErrorPath(ctx.state).path = (base + ('.to')).split('.');
                const nextLayer = pushState(ctx);
                nextLayer.state.auto.index = i;
                nextLayer.state.auto.value = item;
                nextLayer.state.auto.key = key;
                i++;
                return (parseNextStructure(nextLayer, clone(to))).data
            });
        },
        remap: (parent: Moss.ReturnValue, args: any) => {
            const base = currentErrorPath(parent.state).path.join('.');
            const { from, to } = args;
            if (!from) {
                throw ({
                    message: `for $map please supply 'from:' as input`,
                    errorPaths: parent.state.errorPaths,
                });
            }
            currentErrorPath(parent.state).path.push('from');
            const fromCtx = continueWithNewFrame(parent, from);
            currentErrorPath(fromCtx.state).path.pop();
            if (!to) {
                throw ({
                    message: `for $map please supply 'to:' as input`,
                    errorPaths: fromCtx.state.errorPaths,
                    source: args
                });
            }
            let i = 0;
            return okmap(fromCtx.data, (item: any, key: string) => {
                if (fromCtx.state.autoMap[key]) {
                    currentErrorPath(fromCtx.state).path = fromCtx.state.autoMap[key].split('.');
                }
                const ctx = continueWithNewFrame(fromCtx, item);
                currentErrorPath(ctx.state).path = (base + ('.to')).split('.');
                const nextLayer = pushState(ctx);
                nextLayer.state.auto.index = i;
                nextLayer.state.auto.value = item;
                nextLayer.state.auto.memo = key;
                i++;
                return (parseNextStructure(nextLayer, clone(to))).data
            });
        },
        reduce: (parent: Moss.ReturnValue, args: any) => {
            const layer = continueWithNewFrame(parent, args);
            const { data } = layer;
            if (!data.each) {
                throw ({
                    message: `for $reduce please supply 'each:' as branch`,
                    errorPaths: layer.state.errorPaths,
                    source: data
                });
            }
            if (!data.with) {
                throw ({
                    message: `for $reduce please supply 'with:' in branch`,
                    errorPaths: layer.state.errorPaths,
                    source: data
                });
            }
            if (check(data.each, Array)) {
                let res: any = data.memo;
                for (const i in data.each) {
                    const val = data.each[i];
                    const layer = continueWithNewFrame(parent, val);
                    if (functions[data.with]) {
                        res = functions[data.with](layer, { value: val, memo: res, index: i });
                    }
                    else {
                        const nextLayer = pushState(layer);
                        nextLayer.state.auto.index = i;
                        nextLayer.state.auto.value = val;
                        nextLayer.state.auto.memo = res;
                        res = (parseNextStructure(nextLayer, data.with)).data;
                    }
                };
                parent.data = res;
            }
            if (check(data.each, Object)) {
                let i = 0;
                const nextLayer = pushState(layer);
                const { state } = nextLayer;
                state.auto.memo = data.memo || 0;
                for (const key in data.each) {
                    const val = data.each[key];
                    state.auto.index = i;
                    i++;
                    state.auto.key = key;
                    state.auto.value = val;
                    const res = (parseNextStructure(nextLayer, clone(data.with))).data;
                    if (check(res, Object)) {
                        extend(nextLayer.state.auto.memo, res);
                    }
                    else state.auto.memo = res;
                };
                parent.data = state.auto.memo;
            }
        },
        compare: (parent: Moss.ReturnValue, _args: any) => {
            const args = (continueWithNewFrame(parent, _args)).data;
            const [first, ...rest] = args;
            const res = all(rest, (arg) => {
                return isEqual(arg, first);
            });
            parent.data = res;
        },
        group: (parent: Moss.ReturnValue, args: any) => {
            const layer = continueWithNewFrame(parent, args);
            const { data } = layer;
            parent.data = sum(data, (v: any) => v);
        },
        sum: (parent: Moss.ReturnValue, args: any) => {
            const layer = continueWithNewFrame(parent, args);
            const { data } = layer;
            parent.data = sum(data, (v: any) => v);
        }
    });

    const jsonSchemaKeywords = ['id', 'schema', 'ref', 'comment'];
    const mongoKeywords = ['set', 'unset', 'push', 'pull', 'gt', 'lt', 'gte', 'lte', 'exists'];
    const keywords = okmapSync(jsonSchemaKeywords.concat(mongoKeywords), (key) => ({ key, value: key }));

    function interpolate(layer: Moss.ReturnValue, input: any) {
        const { data, state } = layer;
        const dictionary = { ...state.auto, ...keywords, stack: state.stack }
        const res = _interpolate(layer, input, dictionary);
        return { data: res, state: layer.state } as Moss.ReturnValue;
    }

    const interpolationFunctions = {};

    export function setOptions(options: Expand.Options) {
        extend(interpolationFunctions, options);
    }

    export const dereference = (str: string, { layer, dictionary, popAll, sourceMap }: any) => { // replace from trie
        if (!str) return;
        popAll();
        pushErrorPath(layer.state, {
            path: sourceMap,
            rhs: true
        });
        const res = valueForKeyPath(str, dictionary);
        if (res) {
            let errorPath = [];
            const [firstKey, ...remainder] = str.split('.');
            if (layer.state.autoMap[firstKey]) {
                const kpLocation = layer.state.autoMap[firstKey];
                errorPath = kpLocation.split('.').concat(remainder);
            }
            popAll();
            pushErrorPath(layer.state, {
                path: [errorPath]
            })
            const nextLayer: Moss.ReturnValue = parseNextStructure(layer, valueForKeyPath(str, dictionary));
            return nextLayer.data;
        }
        return res;
    }

    function _interpolate(layer: Moss.ReturnValue, input: any, dictionary: any) {
        let popAll = 0;
        const options = {
            ...{
                dereferenceSync: (str: string, sourceMap: any) => Sync.dereference(str, { sourceMap, layer, dictionary, popAll: () => popAll++ }),
                dereference: (str: string, sourceMap: any) => dereference(str, { sourceMap, layer, dictionary, popAll: () => popAll++ }),
                call: (obj: Object, sourceMap: any) => { // call method
                    const keys = Object.keys(obj);
                    if (!(keys && keys.length)) return '';
                    const nextLayer: Moss.ReturnValue = parseNextStructure(layer, obj);
                    const res = nextLayer.data;
                    return res;
                },
                fetch: (uris: string, sourceMap: any) => {
                    popAll++;
                    pushErrorPath(layer.state, {
                        path: sourceMap,
                        rhs: true
                    });
                    let resolvedBranch;
                    try {
                        resolvedBranch = getBranch(uris, resolvers, layer);
                    } catch (e) {
                        throw ({
                            message: `Can't resolve ${uris}\n ${e.message}`,
                        })
                    }
                    if (!resolvedBranch) {
                        throw ({
                            message: `Can't resolve ${uris}\nNone of the available resolvers found a match.\n[${(map(resolvers, (r) => r.name)).filter(e => e).join(', ')}] `,
                        })
                    }
                    if (resolvedBranch.data) {
                        popAll++;
                        pushErrorPath(layer.state, { path: ['^' + resolvedBranch.path] })
                        const res: Moss.ReturnValue = parseNextStructure(layer, resolvedBranch.data);
                        const { data, state: { auto, stack, selectors, merge } } = res;
                        resolvedBranch.intermediate = { data, state: { auto, stack, selectors, merge } };
                        return data;
                    }
                },
                shell: () => 'no shell method supplied',
                getStack: () => {
                    if (!layer.state.strict) {
                        return { ...layer.state.auto, ...layer.data, stack: layer.state.stack };
                    }
                    return { stack: layer.state.stack }
                }
            }, ...interpolationFunctions
        }
        let { value, changed } = __interpolate(input, options);
        if (changed) {
            if (check(value, Object)) {
                return clone(value);
            }
            value = _interpolate(layer, value, dictionary);
        } else {
            value = clone(value) // object immutability
        }
        for (let i = 0; i < popAll; i++) {
            popErrorPath(layer.state);
        }
        popAll = 0;
        return value;
    }

    export function start(trunk: Moss.BranchData) {
        return parseNextStructure(newLayer(), trunk);
    }

    export function startBranch(branch: Moss.Branch) {
        const res = parseNextStructure(newLayer(branch), branch.data);
        const { data, state: { auto, stack, selectors, merge } } = res;
        branch.intermediate = { data, state: { auto, stack, selectors, merge } };
        return res;
    }

    export function parse(trunk: Moss.BranchData, baseParser?: Moss.BranchData) {
        if (baseParser) {
            const layer = parseNextStructure(newLayer(), baseParser);
            return (parseNextStructure(layer, trunk)).data;
        }
        return (start(trunk)).data;
    }

    export function fromJSON(config: string, baseParser?: string) {
        if (baseParser) {
            return parse(JSON.parse(config), JSON.parse(baseParser));
        }
        return parse(JSON.parse(config));
    }

    export function load(config: string, baseParser?: string) {
        if (baseParser) {
            return parse(yaml.load(config), yaml.load(baseParser));
        }
        return parse(yaml.load(config));
    }

    export function transform(config: string, baseParser?: string) {
        return yaml.dump(load(config, baseParser));
    }

}