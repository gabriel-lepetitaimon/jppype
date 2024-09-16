export function dict2lookup(labels: number[] | number, mapping: { [key: number]: string}, default_value: string=''): {[key: number]: string } | string[] {
    default_value = mapping[0] || default_value;
    if(Array.isArray(labels)) {
        const c = Object.fromEntries((labels as number[])
                                  .filter(l => l!==0)
                                  .map(l => {
            let v;
            if (l in mapping) {
                v = mapping[l];
            } else {
                v = default_value[(l - 1) % default_value.length];
            }
            return [l, v];
        }));
        return c;
    } else {
        return Array.from({length: labels+1}, (_, i) => i).map(l => {
            if(l===0) return default_value;
            let v;
            if (l in mapping) {
                v = mapping[l];
            } else {
                v = default_value[(l - 1) % default_value.length];
            }
            return v;
        });
    }
}