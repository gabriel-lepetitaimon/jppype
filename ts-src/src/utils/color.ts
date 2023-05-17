export function hexToRGBA(hex: string): [number, number, number, number] {
    if(/^#([A-Fa-f0-9]{3,4}){1,2}$/.test(hex)){
        let c= hex.substring(1).split('');
        if(c.length== 3){
            c = [c[0], c[0], c[1], c[1], c[2], c[2], 'FF'];
        } else if (c.length==4) {
            c = [c[0], c[0], c[1], c[1], c[2], c[2], c[3], c[3]];
        } else if (c.length == 6) {
            c = [...c, 'FF'];
        }
        const standardizedColor = c.join('');
        const r = parseInt(standardizedColor.substring(0,2), 16);
        const g = parseInt(standardizedColor.substring(2,4), 16);
        const b = parseInt(standardizedColor.substring(4,6), 16);
        const a = parseInt(standardizedColor.substring(6,8), 16);
        return [r, g, b, a];
    }
    throw new Error('Bad Hex Color format: ' + hex);
}