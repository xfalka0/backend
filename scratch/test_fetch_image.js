const axios = require('axios');

async function testFetch() {
    const url = 'https://res.cloudinary.com/dqnmw4mru/image/upload/v1772406031/dating_app_uploads/1772406030967-809366560.jpg';
    try {
        console.log('Fetching image URL:', url);
        const res = await axios.head(url);
        console.log('Status code:', res.status);
        console.log('Headers:', res.headers);
    } catch (e) {
        console.error('Fetch failed:', e.message);
    }
}
testFetch();
