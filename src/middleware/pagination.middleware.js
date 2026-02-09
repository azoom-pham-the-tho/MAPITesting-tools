function paginate(options = {}) {
  const maxLimit = options.maxLimit || 500;

  return (req, res, next) => {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 100, maxLimit);
    const offset = (page - 1) * limit;

    req.pagination = {
      page,
      limit,
      offset,
      setTotal: (total) => {
        res.set('X-Total-Count', total);
        const totalPages = Math.ceil(total / limit);
        res.set('X-Total-Pages', totalPages);
      }
    };

    next();
  };
}

module.exports = paginate;
