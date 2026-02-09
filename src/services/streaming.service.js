class StreamingService {
  async streamArray(res, dataIterator, options = {}) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Transfer-Encoding', 'chunked');

    res.write('[');
    let first = true;

    for await (const item of dataIterator) {
      if (!first) res.write(',');
      res.write(JSON.stringify(item));
      first = false;
    }

    res.write(']');
    res.end();
  }
}

module.exports = new StreamingService();
