const { app } = require('@azure/functions');
const axios = require('axios');
const cheerio = require('cheerio');

app.http('fetch_zipcode_info', {
    methods: ['GET', 'POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log('Node.js HTTP trigger function processed a request.');

        let zipcode = request.query.get('zipcode');
        if (!zipcode) {
            try {
                const reqBody = await request.json();
                zipcode = reqBody.postal_code;
            } catch (error) {
                context.log('Error parsing request body:', error);
            }
        }

        if (zipcode) {
            const url = `https://www.japanpostalcode.net/search.php?keyword=${zipcode}`;

            try {
                const response = await axios.get(url);
                const html_content = response.data;
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

                if (districts.length === 0) {
                    return { 
                        body: 'No district or city found for the provided zipcode',
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
