const { app } = require('@azure/functions');
const puppeteer = require('puppeteer');

app.http('fetch_zipcode_info', {
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
                const browser = await puppeteer.launch();
                const page = await browser.newPage();
                await page.goto(url, { waitUntil: 'networkidle2' });

                const search_result_header = await page.$eval('h1', el => el.textContent);
                const search_result_summary = await page.$eval('p[style="font-size:18px;"]', el => el.textContent);

                const districts = await page.$$eval('table.search-table tr', rows => {
                    return rows.map(row => {
                        const cells = row.querySelectorAll('td');
                        return cells.length > 1 ? cells[1].textContent.trim() : null;
                    }).filter(district => district);
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