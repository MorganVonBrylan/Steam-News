
Function.noop ??= ()=>{};

Number.prototype.padStart = function(...args) {
    return this.toString().padStart(...args);
}