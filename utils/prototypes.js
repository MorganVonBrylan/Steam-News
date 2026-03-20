
Function.noop ??= ()=>{};

Object.null ??= Object.freeze(Object.create(null));

Set.prototype.join ??= function(separator) { return Array.from(this).join(separator); }