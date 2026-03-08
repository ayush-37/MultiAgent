import * as cheerio from 'cheerio';

/**
 * Scrapes restaurant details from a Zomato city page.
 * Uses got-scraping for fast HTTP with browser-like TLS fingerprinting.
 *
 * Extracts from JSON-LD structured data embedded in the page:
 *   name, cuisine, rating, reviewCount, address, url, image
 *
 * @param {string} url - Zomato city URL, e.g. "https://www.zomato.com/varanasi"
 * @param {number} [maxResults=10] - Maximum number of restaurants to return
 * @returns {Promise<Array<Object>>} Array of restaurant objects
 */
export async function scrapeRestaurants(url, maxResults = 10) {
    const { gotScraping } = await import("got-scraping");

    const response = await gotScraping({
        url,
        headerGeneratorOptions: {
            browsers: [{ name: "chrome", minVersion: 120 }],
            devices: ["desktop"],
            operatingSystems: ["windows"],
        },
        timeout: { request: 15000 },
    });

    if (response.statusCode !== 200) {
        throw new Error(`Request failed with status ${response.statusCode}`);
    }

    const $ = cheerio.load(response.body);
    const restaurants = [];

    // Zomato embeds structured JSON-LD (Schema.org ItemList) in the page
    $('script[type="application/ld+json"]').each((_, el) => {
        try {
            const json = JSON.parse($(el).html());

            // Look for the ItemList containing restaurant data
            if (json["@type"] !== "ItemList" || !json.itemListElement) return;

            for (const item of json.itemListElement) {
                const resto = item.item;
                if (!resto || resto["@type"] !== "Restaurant") continue;

                const rating = resto.aggregateRating || {};

                restaurants.push({
                    name: resto.name || "",
                    cuisine: resto.servesCuisine || "",
                    rating: parseFloat(rating.ratingValue) || 0,
                    reviewCount: rating.reviewCount || "0",
                    address: resto.address?.streetAddress || "",
                    url: resto.url
                        ? (resto.url.startsWith("http")
                            ? resto.url
                            : `https://www.zomato.com${resto.url}`)
                        : "",
                    image: resto.image || "",
                });
            }
        } catch (_) {
            // Skip non-JSON or non-matching scripts
        }
    });

    return restaurants.slice(0, maxResults);
}

