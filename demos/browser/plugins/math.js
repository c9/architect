define(function () {

    mathPlugin.provides = ["math"];
    return mathPlugin;

    function mathPlugin(options, imports, register) {
        register(null, {math: {
            add: function (a,b) { return a + b; },
            subtract: function (a, b) { return a - b; },
            multiply: function (a, b) { return a * b; },
            divide: function (a, b) { return a / b; }
        }});
    }

});