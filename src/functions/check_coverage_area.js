const { app } = require('@azure/functions');
const axios = require('axios');
const proj4 = require('proj4');

// Define the EPSG:3857 and EPSG:4326 projections
const EPSG3857 = 'EPSG:3857';
const EPSG4326 = 'EPSG:4326';

// Define the projection transformation
proj4.defs(EPSG3857, '+proj=merc +lon_0=0 +k=1 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs');
proj4.defs(EPSG4326, '+proj=longlat +datum=WGS84 +no_defs');

app.http('check_coverage_area', {
    methods: ['GET', 'POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log(`Http function processed request for url "${request.url}"`);

        let city = request.query.get('city');
        if (!city) {
            try {
                const reqBody = await request.json();
                city = reqBody.city;
            } catch (error) {
                context.log('Error parsing request body:', error);
                return { body: 'Invalid request body', status: 400 };
            }
        }

        if (!city) {
            return { body: 'Please provide a city', status: 400 };
        }

        try {
            context.log(`Geocoding city: ${city}`);
            // Geocode the city name to get latitude and longitude
            const geocodeUrl = `https://nominatim.openstreetmap.org/search?city=${encodeURIComponent(city)}&format=json&limit=1`;
            const geocodeResponse = await axios.get(geocodeUrl, {
                headers: {
                    'User-Agent': 'RakutenCoverageMap/1.0 (kk@kk.com)' // Set a custom User-Agent
                }
            });
            const geocodeData = geocodeResponse.data;

            if (geocodeData.length === 0) {
                context.log('City not found');
                return { body: 'City not found', status: 404 };
            }

            const { lat, lon } = geocodeData[0];
            context.log(`Geocoded coordinates: lat=${lat}, lon=${lon}`);

            // Convert latitude and longitude to EPSG:3857
            const [x, y] = proj4(EPSG4326, EPSG3857, [parseFloat(lon), parseFloat(lat)]);
            context.log(`Converted coordinates to EPSG:3857: x=${x}, y=${y}`);

            // Define the bounding box (BBOX) around the city coordinates
            const bboxSize = 1000; // Adjust the size as needed
            const bbox = [
                x - bboxSize, y - bboxSize,
                x + bboxSize, y + bboxSize
            ].join(',');
            context.log(`Bounding box: ${bbox}`);

            // Replace with the actual Rakuten mobile coverage map API endpoint and parameters
            const apiUrl = `https://area-map.rmb-ss.jp/5g?REQUEST=GetMap&LAYERS=5g&SRS=${EPSG3857}&FORMAT=image/png&TRANSPARENT=TRUE&WIDTH=256&HEIGHT=256&BBOX=${bbox}&update=20240819`;
            context.log(`Requesting coverage data from: ${apiUrl}`);

            // Fetch the image from the API
            const response = await axios.get(apiUrl, {
                responseType: 'arraybuffer', // Ensure the response is treated as binary data
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3'
                }
            });

            // Process the response from the Rakuten mobile coverage map API
            const coverageData = response.data;
            context.log('Received coverage data');

            return {
                body: coverageData,
                headers: { 'Content-Type': 'image/png' },
                isRaw: true, // Ensure the response is treated as raw binary data
                status: 200
            };
        } catch (error) {
            context.log('Error fetching coverage data:', error);
            return { body: 'Error fetching coverage data', status: 500 };
        }
    }
});