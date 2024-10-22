const { app } = require('@azure/functions');
const axios = require('axios');
const cheerio = require('cheerio');

app.http('fetch_postal_code_info', {
    methods: ['GET', 'POST'],
    authLevel: 'function',
    handler: async (request, context) => {
        context.log('Node.js HTTP trigger function processed a request.');

        let postal_code = request.query.get('postal_code');
        if (!postal_code) {
            try {
                const reqBody = await request.json();
                postal_code = reqBody.postal_code;
            } catch (error) {
                context.log('Error parsing request body:', error);
            }
        }

        if (postal_code) {
            const url = `https://www.japanpostalcode.net/search.php?keyword=${postal_code}`;

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
                body: 'Please pass a postal_code on the query string or in the request body',
                status: 400
            };
        }
    }
});