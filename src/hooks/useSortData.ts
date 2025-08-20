import _get from 'lodash.get';

export const sortData = <T>(data: T[], sortKeyList: string[]): T[] => {
    return data.sort((a: T, b: T) => {
        const aValue = _get(a, sortKeyList);
        const bValue = _get(b, sortKeyList);
        if (aValue && bValue) {
            return bValue > aValue ? 1 : -1;
        }
        return 0;
    });
};