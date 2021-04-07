{
  const vars = {
  x: {y: {z: 3}}
  };
  const heap = (x) => vars[x];
  function isNumeric(n) {
    return !n.length && !isNaN(parseFloat(n)) && isFinite(n);
  }
  const isScalar = (x) => {
      return (typeof x == 'string') || isNumeric(x);
  }
}

Start = Simplifiy
Simplifiy = _ expr:ReEntry+ _  {
  return expr && (expr.length > 1 ? expr.join('') : expr[0]);
}

ReEntry = StringComparison / Comparison;

StringComparison = head:((MemberOperator / String / Array) _ ("!")* Keyword) tail:(_ Comparison)* {
  return tail.reduce(function ([lhs], element) {
    const method = head[3];
    const negated = head[2] == "!";
    const arg = element[1];
    // throw new Error(negated)
    let boolean;
    if (typeof lhs == "string") {
      if (method == "contains" || method == "includes") {
        boolean = lhs.indexOf(arg) != -1;
      } else if (method == "startsWith") {
        boolean = lhs.startsWith(arg);
      } else if (method == "endsWith") {
        boolean = lhs.endsWith(arg);
      }
    } else if (Array.isArray(lhs)) {
      if (method == "contains" || method == "includes") {
        boolean = lhs.indexOf(arg) != -1;
      } else if (method == "startsWith") {
        //throw new Error(lhs[0])
        boolean = lhs[0] == arg;
      } else if (method == "endsWith") {
        boolean = lhs.length && lhs[lhs.length - 1] == arg;
      } else if (method == "hasKey") {
      	if (isNumeric(arg)){
      		boolean = lhs.length > arg;
        }
      }
    } else if (typeof lhs == "object") {
      if (method == "hasKey") {
      	boolean = lhs.hasOwnProperty(arg)
      }
    } else {
      throw new Error("bad string comp: " + lhs + method + rhs);
    }
    if (negated) return !boolean;
    return boolean;
  }, head);
}

Comparison = head:AddOp tail:(_ (">=" / "<=" / "==" / "!=" / ">" / "<"   / "= ") _ AddOp)* {
      return tail.reduce(function(result, element) {
      	let cmp;
        const scope = element[1][0] == "!" ? "=" : element[1][0];
        const mode = element[1].length > 1 ? scope == "=" ? element[1][0] : element[1][1] : '';
        switch (scope) {
          case '<': {
          	if (mode == "="){
            	cmp = (a,b) => a <= b;
            }
          	 else cmp = (a,b) => a < b;
             break;
            }
          case '>': {
          	if (mode == "="){
            	cmp = (a,b) => a >= b;
            }
          	 else cmp = (a,b) => a > b;
             break;
            }
          default: {
          	if (mode == "!"){
            	cmp = (a,b) => a != b;
            }
         	else cmp = (a,b) => a == b;
            break;
          }
        }
        return cmp(result, element[3]);
      }, head);
    }

AddOp = head:MulOp tail:(_ ("+" / "-") _ MulOp)* {
      return tail.reduce(function(result, element) {
        if (!isScalar(result)){
          return { [element[1] === "+" ? 'add' : 'subtract']: [result, element[3]]}
        }
        if (element[1] === "+") { return result + element[3]; }
        if (element[1] === "-") { return result - element[3]; }
      }, head);
    }

MulOp = head:Factor tail:(_ ("*" / "/") _ Factor)* {
      return tail.reduce(function(result, element) {
        if (!isScalar(result)){
          return { [element[1] === "*" ? 'multiply' : 'divide']: [result, element[3]]}
        }
        if (element[1] === "*") { return result * element[3]; }
        if (element[1] === "/") { return result / element[3]; }
      }, head);
    }

Factor = "(" _ expr:ReEntry _ ")" { return expr; } / Unary

Unary = UnaryNot / UnaryNeg / Sequence

UnaryNot = "!" c:Factor { return !c }
UnaryNeg = "-" c:Number { return -c }

Sequence = head:(Any) tail:(Space Any)* {
      return tail.reduce(function(head, element) {
        return head + ' ' + element[1];
      }, head);
}

MemberOperator = head:("\\"? Identifier) tail:(("[" Any "]") / ("." Identifier))* {
   	let lhs = head[1];
	if (!head[0]){
      const res = heap(lhs);
      if (res !== undefined){
        lhs = res;
      }
    }

    return tail.reduce(function(result, element) {
        const res = result[element[1]];
        if (res === undefined) throw new Error({ result, accessor: element[1]})
        return res;
    }, lhs);
}


Array = "[" items:ArrayItem+ "]" _ {
	return items;
}

ArrayItem = item:(("," _ ReEntry) / _ ReEntry) {
	return (item[0] && (item[0] == ',')) ? item[2] : item[1];
}

Any = s:"\\ "? w:(MemberOperator / Array / Identifier / Number) { return s ? ' ' + w : w }

Keyword = "contains" / "startsWith" / "endsWith" / "includes" / "hasKey"

Identifier = Word
Word =  left:[_a-zA-Z] right:[_a-zA-Z0-9]* { return left + right.join('') }
String = "\"" s:Text "\""  { return s }
Text = c:[a-zA-Z]* { return c.join('') }

Number = Float / Integer
Float "float" = left:[0-9]+ "." right:[0-9]+ _ { return parseFloat(left.join("") + "." + right.join("")); }
Integer "integer" = [0-9]+ _ { return parseInt(text(), 10); }
Space = [ ]
_ "whitespace" = [ \t\n\r]*
