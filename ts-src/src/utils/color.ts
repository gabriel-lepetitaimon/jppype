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

type DefaultColorsType = string | string[] | undefined;

export type CMapRGBA = {[key: number]: [number, number, number, number]} | [number, number, number, number][];

export function cmap2RGBAlookup(labels: number, cmap: { [key: number]: string }, defaultColors: DefaultColorsType): [number, number, number, number][];
export function cmap2RGBAlookup(labels: number[], cmap: { [key: number]: string }, defaultColors: DefaultColorsType): {[key: number]: [number, number, number, number] };
export function cmap2RGBAlookup(labels: unknown, cmap: { [key: number]: string }, defaultColors:DefaultColorsType =undefined): unknown {
    if (typeof labels == 'number'){
        const hexCmap = cmap2Hexlookup(labels, cmap, defaultColors);
        return hexCmap.map(hexToRGBA);
    } else if (Array.isArray(labels)) {
        const hexCmap = cmap2Hexlookup(labels, cmap, defaultColors);
        return Object.fromEntries(Object.entries(hexCmap).map(([k, v]) => [k, hexToRGBA(v)]));
    }
}

export function cmap2Hexlookup(labels: number[], cmap: { [key: number]: string}, defaultColors:DefaultColorsType): {[key: number]: string };
export function cmap2Hexlookup(labels: number, cmap: { [key: number]: string}, defaultColors:DefaultColorsType): string[];
export function cmap2Hexlookup(labels: unknown, cmap: { [key: number]: string }, defaultColors:DefaultColorsType=undefined): unknown {
    let curatedDefaultColors: string[];
    if (typeof defaultColors == 'string') 
        curatedDefaultColors = [defaultColors];
    else if (defaultColors === undefined)
        curatedDefaultColors = ["#555"];
    else
        curatedDefaultColors = defaultColors as string[];

    if (typeof labels == 'number'){
        return Array.from({length: labels+1}, (_, i) => i).map(l => {
            if(l===0) return "#0000";
            let color: string;
            if (l in cmap) {
                color = cmap[l];
            } else {
                color = curatedDefaultColors[(l - 1) % curatedDefaultColors.length];
            }
            return color;
        });
    } else if(Array.isArray(labels)) {
        const c = Object.fromEntries((labels as number[])
                                        .filter(l => l!==0)
                                        .map(l => {
            let color;
            if (l in cmap) {
                color = cmap[l];
            } else {
                color = curatedDefaultColors[(l - 1) % curatedDefaultColors.length];
            }
            return [l, color];
        }));
        return c;
    } else {
        
    }
}