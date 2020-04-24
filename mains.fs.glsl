precision highp float;

uniform vec2 viewportDimensions;
uniform highp vec2 position;
uniform highp float zoom;
uniform int maxIterations;
uniform float offset;

uniform bool useStaticC;
uniform vec2 staticC;

vec3 rgb2hsv(vec3 c)
{
    vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));

    float d = q.x - min(q.w, q.y);
    float e = 1.0e-10;
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}
vec3 hsv2rgb(vec3 c)
{
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main(){
    vec2 c = vec2(
        (gl_FragCoord.x - viewportDimensions.x / 2.0) / zoom + position.x ,
        (gl_FragCoord.y - viewportDimensions.y / 2.0) / zoom + position.y 
    );

    vec2 z = c;
    int iterations = 0;

    const int maxii = 10000;
    for (int i = 0; i < maxii; i++){

        float cx;
        float cy;

        if (!useStaticC){
            cx = c.x;
            cy = c.y;
        } else {
            cx = staticC.x;
            cy = staticC.y;
        }

        float t = 2.0 * z.x * z.y + cy;
        
        z.x = z.x * z.x - z.y * z.y + cx;
        z.y = t;

        if (z.x * z.x + z.y * z.y > 4.0){
            break;
        }

        iterations++;

        if (iterations >= maxIterations){
            break;
        }
    }

    float value = float(iterations) / float(maxIterations);
    if (iterations >= maxIterations){
        gl_FragColor = vec4(
            0.0,
            0.0,
            0.0,
            1.0
        );
        // gl_FragColor = vec4(
        //     0.0,
        //     0.0,
        //     0.0,
        //     1.0
        // );
        return;
    }

    vec3 gradColor = vec3(
        value,
        0.0,
        0.0
    );

    vec3 hsvColor = rgb2hsv(gradColor);
    hsvColor[0] += value + (offset + 300.0) / 360.0;
    if (hsvColor[0] > 1.0){
        hsvColor[0] = hsvColor[0] - (1.0 * floor(hsvColor[0] / 1.0));
    }

    vec3 finalColor = hsv2rgb(hsvColor);

    gl_FragColor = vec4(finalColor, 1.0);

}

