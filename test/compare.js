const selectors = { // $select
    'host-mac': true,
    'host-linux': false,
    production: true,
    debug: false,
    ios: true,
    mac: false
}

const host = { // $
    ninja: {
        version: ''
    },
    compiler: ''
}
if (selectors['host-mac']) { // -host-mac
    host.ninja.version = '1.5.7';
    host.compiler = 'clang';
}
if (selectors['host-linux']) {
    host.ninja.version = '1.4'; // -host-linux
    host.compiler = 'gcc';
}

selectors.useCustomLibrary = false; // -*
if (selectors.ios) selectors.useCustomLibrary = true; // -useCustomLibrary

let graphicsLib = 'opengl'; // -*
if (selectors.win) graphicsLib = 'directx'; // -win

const targets = {};
if (selectors.mac || selectors.linux) { // -mac, linux
    targets.device = {
        arch: 'x64',
        endianness: 'LE'
    }
}
if (selectors.ios && !selectors.linux) { // -ios, !linux
    targets.device = {
        arch: 'arm',
        endianness: 'BE'
    };
    targets.simulator = {
        arch: 'x64',
        endianness: 'LE'
    };
}

const out = {
    build: {},
    require: {
        requiredLibrary: 'tmake/requiredLibrary'
    }
};

for (const key of Object.keys(targets)) { // $map
    const target = targets[key];
    out.build[key] = {
        ninja: {
            fetch: `http://ninja-v${host.ninja.version}.tar.gz`,
            cc: host.compiler
        }
    };
    const ref = out.build[key];
    const endianness = { // $
        LE: 4321,
        BE: 1234
    }
    ref.defines = { TARGET_ENDIANNESS: endianness[target.endianness] } // ${${endianness}}
    ref.cFlags = {}
    if (selectors.production) { // -production
        ref.cFlags.wAll = true;
        ref.cFlags.O = 3;
    }
    if (selectors.debug) { // -debug
        ref.cFlags.O = 0;
    }
    ref.link = { [graphicsLib]: graphicsLib };
}

if (selectors.useCustomLibrary) {
    out.require.customLibrary = 'tmake/customLibrary'
}

exports.default = out;