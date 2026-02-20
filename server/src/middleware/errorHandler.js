/**
 * Global error handling middleware.
 * Ensures all errors return a consistent { success, data, message } shape.
 */
export function errorHandler(err, req, res, _next) {
    console.error('Unhandled error:', err.message);

    const statusCode = err.statusCode || 500;

    res.status(statusCode).json({
        success: false,
        data: null,
        message: err.message || 'Internal server error',
    });
}

/**
 * Wraps an async route handler to catch errors and forward them to Express.
 */
export function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}
