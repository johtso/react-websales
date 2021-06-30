import { reduce } from 'iter-tools';

// *** Arrays ***

const groupedMap = <T, U extends keyof T, V extends T[U]>(
  initialArray: T[],
  property: U
): Map<V, T[]> =>
  initialArray.reduce(
    (resultMap, obj: T) =>
      resultMap.set(obj[property], [...(resultMap.get(obj[property]) || []), obj]),
    new Map()
  );

const sum = (numbers: Iterable<number>): number =>
  reduce(0, (result, value) => result + value, numbers);

// *** Sets ***

function difference<T>(setA: Set<T>, setB: Set<T>): Set<T> {
  const diff = new Set(setA);
  for (const elem of setB) {
    diff.delete(elem);
  }
  return diff;
}

// Delete value from Set if present, otherwise add.
const toggleSetValue = <T>(set: Set<T>, value: T): void => {
  if (set.has(value)) {
    set.delete(value);
  } else {
    set.add(value);
  }
};

// *** Other ***

// setTimeout wrapped as a Promise.
// sleep(5000).then(...)
const sleep = (ms: number): Promise<() => unknown> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export { groupedMap, sleep, sum, difference, toggleSetValue };
