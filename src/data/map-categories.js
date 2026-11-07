export const mapCategories = Object.freeze([
  Object.freeze({ id: 'parks', label: 'National parks', color: '#607d43' }),
  Object.freeze({ id: 'trails', label: 'Trails', color: '#317a8a' }),
  Object.freeze({ id: 'landmarks', label: 'Landmarks', color: '#9c6a9f' }),
]);

export const mapCategoryColors = Object.freeze(Object.fromEntries(
  mapCategories.map(({ id, color }) => [id, color]),
));
