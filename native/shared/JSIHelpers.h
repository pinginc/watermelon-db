#pragma once

namespace watermelondb {

using platform::consoleError;
using platform::consoleLog;

jsi::Value makeError(facebook::jsi::Runtime &rt, const std::string &desc) {
    return rt.global().getPropertyAsFunction(rt, "Error").call(rt, desc);
}

jsi::Value runBlock(facebook::jsi::Runtime &rt, std::function<jsi::Value(void)> block) {
    jsi::Value retValue;
    // NOTE: C++ Exceptions don't work correctly on Android -- most likely due to the fact that
    // we don't share the C++ stdlib with React Native targets, which means that the executor
    // doesn't know how to catch our exceptions to turn them into JS errors. As a workaround,
    // we catch those ourselves and return JS Errors instead of throwing them in JS VM.
    // See also:
    // https://github.com/facebook/hermes/issues/422 - REA also catches all exceptions in C++
    //    but then passes them to Java world via JNI
    // https://github.com/facebook/hermes/issues/298#issuecomment-661352050
    // https://github.com/facebook/react-native/issues/29558
    #if __ANDROID__ || defined(WIN32) || defined(_WIN32) || defined(__WIN32__) || defined(__NT__)
    try {
        retValue = block();
    } catch (const jsi::JSError &error) {
        retValue = makeError(rt, error.getMessage());
    } catch (const std::exception &ex) {
        std::string exceptionString("Exception in HostFunction: ");
        exceptionString += ex.what();
        retValue = makeError(rt, exceptionString);
    } catch (...) {
        std::string exceptionString("Exception in HostFunction: <unknown>");
        retValue = makeError(rt, exceptionString);
    }
    #else
    retValue = block();
    #endif
    return retValue;
}

using jsiFunction = std::function<jsi::Value(jsi::Runtime &rt, const jsi::Value *args)>;
using jsiFunctionWithCount = std::function<jsi::Value(jsi::Runtime &rt, const jsi::Value *args, size_t count)>;

void createMethod(jsi::Runtime &runtime, jsi::Object &object, const char *methodName, unsigned int minArgCount, unsigned int maxArgCount, jsiFunctionWithCount func) {
    jsi::PropNameID name = jsi::PropNameID::forAscii(runtime, methodName);
    jsi::Function function = jsi::Function::createFromHostFunction(runtime, name, maxArgCount, [methodName, minArgCount, maxArgCount, func]
                                                                   (jsi::Runtime &rt, const jsi::Value &, const jsi::Value *args, size_t count) {
        if (count < minArgCount || count > maxArgCount) {
            std::string expected = minArgCount == maxArgCount
                ? std::to_string(maxArgCount)
                : std::to_string(minArgCount) + "-" + std::to_string(maxArgCount);
            std::string error = std::string(methodName) + " takes " + expected + " arguments";
            #ifdef ANDROID
            consoleError(error);
            std::abort();
            #else
            throw std::invalid_argument(error);
            #endif
        }
        return runBlock(rt, [&]() {
            return func(rt, args, count);
        });
    });
    object.setProperty(runtime, name, function);
}

void createMethod(jsi::Runtime &runtime, jsi::Object &object, const char *methodName, unsigned int argCount, jsiFunction func) {
    createMethod(runtime, object, methodName, argCount, argCount, [func](jsi::Runtime &rt, const jsi::Value *args, size_t) {
        return func(rt, args);
    });
}
}
