export function formatCop(value:number|string){return Number(value).toLocaleString("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:2});}
export function accountStatusLabel(value:string){return value==="current"?"Al día":value==="overdue"?"En mora":"Pendiente";}
