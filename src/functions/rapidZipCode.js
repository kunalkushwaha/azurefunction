const { app } = require('@azure/functions');
const request = require('request');

app.http('rapidZipCode', {
    methods: ['GET', 'POST'],
    authLevel: 'anonymous',
    handler: async (req, context) => {
        context.log(`Http function processed request for url "${req.url}"`);

        let zipcode = req.query.get('zipcode');
        if (!zipcode) {
            try {
                const reqBody = await req.json();
                zipcode = reqBody.zipcode;
            } catch (error) {
                context.log('Error parsing request body:', error);
                return { body: 'Invalid request body', status: 400 };
            }
        }

        if (!zipcode) {
            return { body: 'Please provide a zipcode', status: 400 };
        }

        // Read the RapidAPI key from environment variables
        const rapidApiKey = process.env.RAPIDAPI_KEY;
        if (!rapidApiKey) {
            context.log('RapidAPI key is not set');
            return { body: 'RapidAPI key is not set', status: 500 };
        }

        const options = {
            method: 'POST',
            url: 'https://japanese-postal-code.p.rapidapi.com/zipcode',
            headers: {
                'x-rapidapi-key': rapidApiKey,
                'x-rapidapi-host': 'japanese-postal-code.p.rapidapi.com',
                'Content-Type': 'application/json'
            },
            body: { zipcode: zipcode },
            json: true
        };

        return new Promise((resolve, reject) => {
            request(options, function (error, response, body) {
                if (error) {
                    context.log('Error making request to RapidAPI:', error);
                    resolve({ body: 'Error making request to RapidAPI', status: 500 });
                } else {
                    context.log('Response from RapidAPI:', body);
                    if (body.status === 200 && body.results && body.results.length > 0) {
                        const result = body.results[0];
                        const addressJapanese = `${result.address1} ${result.address2} ${result.address3}`;
                        const addressEnglish = `${result.alpha1} ${result.alpha2} ${result.alpha3}`;
                        const responseBody = {
                            addressJapanese,
                            addressEnglish
                        };
                        resolve({ body: JSON.stringify(responseBody), headers: { 'Content-Type': 'application/json' }, status: 200 });
                    } else {
                        resolve({ body: 'No results found for the provided zipcode', status: 404 });
                    }
                }
            });
        });
    }
});