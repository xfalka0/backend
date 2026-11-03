const axios = require('axios');
(async () => {
  try {
    const res = await axios.get('http://localhost:5000/api/discovery?tab=Önerilen&page=1&limit=50', {
      headers: { 'Authorization': 'Bearer test' } // token is probably invalid but maybe it will throw the db error anyway if it's during schema query, wait authentication will fail.
    });
    console.log("Success");
  } catch (err) {
    if (err.response) {
      console.error(err.response.data);
    } else {
      console.error(err.message);
    }
  }
})();
