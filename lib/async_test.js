var assert = require("assert");
var async = require("./async");

module.exports = {
    
    "test for each": function(next) {
        var args = [];
        async.forEach([1, 2, 3], function(i, next) {
            args.push(i);
            next();
        }, function(err) {
            assert.equal(err, null);
            assert.equal([1, 2, 3] + "", args + "");
            next();
        });
    },
    
    "test chain": function(next) {
        
        var i = 0;
        async.chain(
            function(callback) {
                assert.equal(i++, 0);
                callback();
            },
            function(callback) {
                assert.equal(i++, 1);
                callback();
            },
            function(err) {
                assert.equal(err, null);
                assert.equal(i++, 2);
                next();
            }
        );
    }
}

!module.parent && require("asyncjs").test.testcase(module.exports).exec();
