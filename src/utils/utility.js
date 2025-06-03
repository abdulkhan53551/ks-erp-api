// Main function
function stringToJsonLogic(expression) {
    const tokens = tokenize(expression);
    const ast = parseExpression(tokens);
    return ast;
}

// Tokenize input string into manageable tokens
function tokenize(str) {
    const regex = /\s*(=>|==|!=|<=|>=|&&|\|\||[(),<>]|"(?:\\.|[^"\\])*"|[a-zA-Z_]\w*(?:\.[a-zA-Z_]\w*)*|\d+(?:\.\d+)?|[\w-]+)\s*/g;
    const result = [];
    let match;
    while ((match = regex.exec(str)) !== null) {
        result.push(match[1]);
    }
    return result;
}

// Parse logic expression from tokens
function parseExpression(tokens) {
    const parseOr = () => {
        let left = parseAnd();
        while (tokens[0] === '||') {
            tokens.shift();
            const right = parseAnd();
            left = { or: flattenConditions(left, right, 'or') };
        }
        return left;
    };

    const parseAnd = () => {
        let left = parseComparison();
        while (tokens[0] === '&&') {
            tokens.shift();
            const right = parseComparison();
            left = { and: flattenConditions(left, right, 'and') };
        }
        return left;
    };

    const parseComparison = () => {
        if (tokens[0] === '(') {
            tokens.shift();
            const expr = parseOr();
            if (tokens[0] !== ')') throw new Error('Expected ")"');
            tokens.shift();
            return expr;
        }

        // Check for function call
        if (/^[a-zA-Z_]\w*$/.test(tokens[0]) && tokens[1] === '(') {
            return parseFunctionCall();
        }

        const left = tokens.shift();
        const operator = tokens.shift();
        const right = tokens.shift();

        if (!left || !operator || !right) throw new Error('Invalid expression');

        const ops = ['==', '!=', '>', '<', '>=', '<='];
        if (!ops.includes(operator)) throw new Error(`Unsupported operator: ${operator}`);

        return {
            [operator]: [
                isVariable(left) ? { var: left } : parseLiteral(left),
                isVariable(right) ? { var: right } : parseLiteral(right)
            ]
        };
    };

    const parseFunctionCall = () => {
        const fnName = tokens.shift();
        tokens.shift(); // remove '('

        const args = [];
        while (tokens.length > 0 && tokens[0] !== ')') {
            if (tokens[0] === ',') {
                tokens.shift();
                continue;
            }

            if (tokens[0] === '(') {
                args.push(parseExpression(tokens));
            } else {
                const token = tokens.shift();
                args.push(isVariable(token) ? { var: token } : parseLiteral(token));
            }
        }

        if (tokens[0] !== ')') throw new Error('Expected ")" in function call');
        tokens.shift();

        return {
            [fnName]: args
        };
    };

    return parseOr();
}

// Helpers
function flattenConditions(left, right, key) {
    return [
        ...(left[key] ? left[key] : [left]),
        ...(right[key] ? right[key] : [right])
    ];
}

function parseLiteral(token) {
    if (token.startsWith('"') && token.endsWith('"')) {
        return JSON.parse(token);
    } else if (!isNaN(token)) {
        return parseFloat(token);
    } else {
        return token;
    }
}

function isVariable(token) {
    return /^[a-zA-Z_]\w*(\.[a-zA-Z_]\w*)*$/.test(token);
}

// Convert JSON Logic to string representation
const jsonLogicToString = (logic) => {
    if (typeof logic !== 'object' || logic === null) return "";

    const op = Object.keys(logic)[0];
    const args = logic[op];

    const format = (arg) => {
        if (typeof arg === 'object' && arg !== null && 'var' in arg) {
            // Return variable path as-is (e.g., r.sub.role)
            return arg.var;
        } else if (typeof arg === 'string') {
            // Escape inner quotes and wrap in double quotes
            const escaped = arg.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
            return `"${escaped}"`;
        } else if (Array.isArray(arg)) {
            // Format arrays (for in operator or others)
            return `[${arg.map(format).join(', ')}]`;
        } else if (typeof arg === 'object') {
            // Nested JSONLogic expression
            return `(${jsonLogicToString(arg)})`;
        } else {
            // Number, boolean, etc.
            return String(arg);
        }
    };

    switch (op) {
        case '==': return `${format(args[0])} == ${format(args[1])}`;
        case '!=': return `${format(args[0])} != ${format(args[1])}`;
        case '>': return `${format(args[0])} > ${format(args[1])}`;
        case '>=': return `${format(args[0])} >= ${format(args[1])}`;
        case '<': return `${format(args[0])} < ${format(args[1])}`;
        case '<=': return `${format(args[0])} <= ${format(args[1])}`;
        case 'and': return `(${args.map(jsonLogicToString).join(' && ')})`;
        case 'or': return `(${args.map(jsonLogicToString).join(' || ')})`;
        case '!': return `!(${jsonLogicToString(args[0])})`;
        case 'in': return `${format(args[0])} in ${format(args[1])}`;
        default:
            // Assume function call: op(args...)
            return `${op}(${args.map(format).join(', ')})`;
    }
};

// Validate JSON Logic
const isValidJsonLogic = (rule) => {
    if (typeof rule !== 'object' || rule === null || Array.isArray(rule)) {
        return false;
    }

    const allowedOps = new Set([
        '==', '!=', '>', '>=', '<', '<=',
        '!', 'and', 'or', 'if', 'var',
        '+', '-', '*', '/', '%',
        'in', 'all', 'some', 'none',
        'missing', 'missing_some',
        'map', 'reduce', 'filter'
    ]);

    const keys = Object.keys(rule);
    if (keys.length !== 1) return false;

    const op = keys[0];
    return allowedOps.has(op);
}

module.exports = {
    jsonLogicToString,
    isValidJsonLogic,
    stringToJsonLogic
}