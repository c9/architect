define(function () {

    appPlugin.consumes = ["math"];
    return appPlugin;

    function appPlugin(options, imports, register) {
        console.log("math", imports.math);
        register();
    }

});