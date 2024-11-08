const { app } = require('@azure/functions');
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

app.http('ch-zipcode', {
    methods: ['GET', 'POST'],
    authLevel: 'function',
    handler: async (request, context) => {
        context.log('Node.js HTTP trigger function processed a request.');

        let zipcode = request.query.get('zipcode');
        if (!zipcode) {
            try {
                const reqBody = await request.json();
                zipcode = reqBody.zipcode;
            } catch (error) {
                context.log('Error parsing request body:', error);
            }
        }

        if (zipcode) {
            const url = `https://www.japanpostalcode.net/search.php?keyword=${zipcode}`;

            try {
                // Launch Puppeteer and navigate to the URL
                const browser = await puppeteer.launch({
                    args: ['--no-sandbox', '--disable-setuid-sandbox'],
                    headless: true,
                    executablePath: './chrome-linux/chrome'
                });
                const page = await browser.newPage();

                // Set the cookies and user agent
                await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3');
                await page.setCookie(
                    { name: 'get_postal_code', value: '#2133435', domain: 'www.japanpostalcode.net' },
                    { name: 'kunal_code', value: '#32423534654', domain: 'www.japanpostalcode.net' }
                );

                await page.goto(url, { waitUntil: 'networkidle2' });

                // Get the HTML content
                const html_content = await page.content();
                const $ = cheerio.load(html_content);

                const search_result_header = $('h1').text();
                const search_result_summary = $('p[style="font-size:18px;"]').text();

                const districts = [];
                $('table.search-table tr').each((index, element) => {
                    const cells = $(element).find('td');
                    if (cells.length > 1) {
                        const district = $(cells[1]).text().trim();
                        districts.push(district);
                    }
                });

                await browser.close();

                if (districts.length === 0) {
                    return { 
                        body: 'No district or city found for the provided postal code',
                        status: 404
                    };
                }

                const result = {
                    search_result_header,
                    search_result_summary,
                    districts
                };

                return { 
                    body: JSON.stringify(result),
                    headers: { 'Content-Type': 'application/json' },
                    status: 200
                };
            } catch (error) {
                context.log('Error fetching or parsing data:', error);
                return { 
                    body: 'Error fetching postal code information',
                    status: 500
                };
            }
        } else {
            return { 
                body: 'Please pass a zipcode on the query string or in the request body',
                status: 400
            };
        }
    }
});