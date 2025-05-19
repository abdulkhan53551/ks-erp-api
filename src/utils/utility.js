

// Parse expression to JSON Logic
function stringToJsonLogic(expression) {
    const tokens = tokenize(expression);
    const ast = parseExpression(tokens);
    return ast;
}

function tokenize(str) {
    const regex = /\s*(=>|==|!=|<=|>=|&&|\|\||[()<>]|[a-zA-Z_]\w*(?:\.[a-zA-Z_]\w*)*|"(?:\\.|[^"\\])*"|[\w-]+)\s*/g;
    const result = [];
    let match;
    while ((match = regex.exec(str)) !== null) {
        result.push(match[1]);
    }
    return result;
}

function parseExpression(tokens) {
    const parseOr = () => {
        let left = parseAnd();
        while (tokens[0] === '||') {
            tokens.shift();
            const right = parseAnd();
            left = { or: [left, right].flatMap(x => x.or ? x.or : [x]) };
        }
        return left;
    };

    const parseAnd = () => {
        let left = parseComparison();
        while (tokens[0] === '&&') {
            tokens.shift();
            const right = parseComparison();
            left = { and: [left, right].flatMap(x => x.and ? x.and : [x]) };
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

        const left = tokens.shift();
        const operator = tokens.shift();
        const right = tokens.shift();

        if (!left || !operator || !right) throw new Error('Invalid comparison');

        const ops = ['==', '!=', '>', '<', '>=', '<='];
        if (!ops.includes(operator)) throw new Error(`Unsupported operator: ${operator}`);

        // Do NOT strip `r.` prefix — keep it in the variable
        const varObj = { var: left };
        const value = right.startsWith('"') ? JSON.parse(right) : right;

        return {
            [operator]: [varObj, value]
        };
    };

    return parseOr();
}



// Convert json logic to string condition
const jsonLogicToString = (logic) => {
    if (typeof logic !== 'object' || logic === null) return "";

    const op = Object.keys(logic)[0];
    const args = logic[op];

    const format = (arg) => {
        if (typeof arg === 'object' && arg.var) {
            return arg.var; // e.g., sub.role
        } else if (typeof arg === 'string') {
            // Remove surrounding escaped quotes if present (e.g., "\"role:1\"" → role:1)
            const cleaned = arg.replace(/^"(.*)"$/, '$1');
            return `"${cleaned.replace(/"/g, '\\"')}"`;
        } else {
            return arg;
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
        case 'in': return `${format(args[0])} in ${JSON.stringify(args[1])}`;
        default: return `${op}(${args.map(jsonLogicToString).join(', ')})`;
    }
};


function jsonLogicToEval(logic) {
    if (typeof logic !== 'object' || logic === null) {
        // Return string values wrapped in quotes, others as-is
        if (typeof logic === 'string') {
            return `"${logic}"`;
        }
        return String(logic);
    }

    const operator = Object.keys(logic)[0];
    const values = logic[operator];

    switch (operator) {
        case 'and':
            return values.map(jsonLogicToEval).join(' && ');
        case 'or':
            return values.map(jsonLogicToEval).join(' || ');
        case '==':
            return `${jsonLogicToEval(values[0])} == ${jsonLogicToEval(values[1])}`;
        case '!=':
            return `${jsonLogicToEval(values[0])} != ${jsonLogicToEval(values[1])}`;
        case '>':
        case '<':
        case '>=':
        case '<=':
            return `${jsonLogicToEval(values[0])} ${operator} ${jsonLogicToEval(values[1])}`;
        case '!':
            return `!(${jsonLogicToEval(values[0])})`;
        case 'var':
            return values; // variable path like "sub.role"
        default:
            throw new Error(`Unsupported operator: ${operator}`);
    }
}




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
    // parseExpressionToJsonLogic,
    jsonLogicToString,
    isValidJsonLogic,
    stringToJsonLogic
}