const { app } = require('@azure/functions');
const axios = require('axios');
const cheerio = require('cheerio');

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
                const response = await axios.get(url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3'
                    }
                });
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
                if (error.response && error.response.status === 403) {
                    return { 
                        body: 'Access to the zip code information is forbidden. Please try again later.',
                        status: 403
                    };
                }
                return { 
                    body: 'Error fetching zip code information',
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