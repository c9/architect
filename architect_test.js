const architect = require("./architect");
const test = require("tape");
const fs = require("fs");
const promisify = require("util").promisify;
const path = require("path");

const readFile = promisify(fs.readFile);
const unlink = promisify(fs.unlink);
const writeFile = promisify(fs.writeFile);
const mkdirp = promisify(require("mkdirp"));

test("resolve config resolved", assert => {
    const config = [
        {
            setup: function(){
                // noop
            },
            provides: ["foo"],
            consumes: ["foo"]
        }
    ];
    
    architect.resolveConfig(config, "", (err, resolvedConfig) => {
        assert.ok(!err, "no error");
        assert.deepEqual(resolvedConfig, config);
        assert.end();
    });
});

test("resolve config from basepath + node_modules", async (assert) => {
    const fakePlugin = `
        module.exports = {
            setup: function(){
                // noop
            },
            provides: ["foo"],
            consumes: ["foo"]
        }
    `;

    let packagePath = "_fake/plugin_" + Date.now();
    let packageDir = "/tmp/_architect_test_fixtures/node_modules";
    let fullPath = packageDir + "/" + packagePath + ".js";
    
    let config = [
        packagePath,
    ];
    
    await mkdirp(path.dirname(fullPath));
    await writeFile(fullPath, fakePlugin.toString());
    
    architect.resolveConfig(config, path.dirname(packageDir), async (err, resolvedConfig) => {
        assert.ok(!err);

        assert.equal(resolvedConfig[0].packagePath, fullPath);
        assert.deepEqual(resolvedConfig[0].consumes, ["foo"]);
        assert.deepEqual(resolvedConfig[0].provides, ["foo"]);

        await unlink(fullPath);
        assert.end();
    });
});

test("resolve config from basepath + node_modules, async", async (assert) => {
    const fakePlugin = `
        module.exports = {
            setup: function(){
                // noop
            },
            provides: ["foo"],
            consumes: ["foo"]
        }
    `;

    let packagePath = "_fake/plugin_" + Date.now();
    let packageDir = "/tmp/_architect_test_fixtures/node_modules";
    let fullPath = packageDir + "/" + packagePath + ".js";
    
    let config = [
        packagePath,
    ];
    
    await mkdirp(path.dirname(fullPath));
    await writeFile(fullPath, fakePlugin.toString());
    
    let resolvedConfig = await architect.resolveConfig(config, path.dirname(packageDir));

    assert.equal(resolvedConfig[0].packagePath, fullPath);
    assert.deepEqual(resolvedConfig[0].consumes, ["foo"]);
    assert.deepEqual(resolvedConfig[0].provides, ["foo"]);

    await unlink(fullPath);
    assert.end();
});
