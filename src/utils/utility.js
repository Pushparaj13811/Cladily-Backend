const capitalize = (word) => {
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

const slugify = (text) => {
    return text.toLowerCase().replace(/ /g, '-');
}

export { capitalize, slugify };