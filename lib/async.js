exports.forEach = function(list, onItem, callback) {
    var i = 0;
    function process() {
        if (i >= list.length)
            return callback();

        onItem(list[i], function(err) {
            if (err)
                return callback(err);
            
            i++;
            process();
        });
    }  
    
    process();
};

exports.chain = function(varargs) {
    var args = Array.prototype.slice.call(arguments);
    var callback = args.pop();
    
    exports.forEach(args, function(fun, next) {
        fun(next);
    }, callback);
};