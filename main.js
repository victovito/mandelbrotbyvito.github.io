function loadShader(url, callback){
    const req = new XMLHttpRequest();
    req.open("GET", url, true);
    req.onload = function(){
        if (req.status != 200){
            callback("Could not load shader from " + url);
        } else {
            callback(null, req.responseText);
        }
    }
    req.send();
}

/** @type {HTMLCanvasElement} */ 
let canvas;
/** @type {WebGLRenderingContext} */ 
let gl;

const slider_i = document.getElementById("slider_i");
let maxIterations = parseInt(slider_i.value);
slider_i.oninput = function(){
    maxIterations = parseInt(slider_i.value);
}
const slider_o = document.getElementById("slider_o");
let offset = parseFloat(slider_o.value);
slider_o.oninput = function(){
    offset = parseFloat(slider_o.value);
}
const check_ot = document.getElementById("offset_over_time");
let offsetOT = check_ot.checked;
let offotStart = Date.now();
check_ot.addEventListener("input", function(e){
    offsetOT = check_ot.checked;
});
const check_ujs = document.getElementById("use_julias_set");
let useJuliasset = check_ujs.checked;
check_ujs.addEventListener("input", function(e){
    useJuliasset = check_ujs.checked;
    if (useJuliasset){
        slider2d.showSlider(true);
    } else {
        slider2d.showSlider(false);
    }
});
let slider2d;

let zoom = 250.0;
let position = [-0.5, 0];

let zoomOut = false;
let zoomIn = false;
let mousePosition = [0, 0];
let mouseDown = false;
function addListeners(element){
    element.addEventListener("mousemove", function(e){
        mousePosition = [
            (e.x - window.innerWidth / 2) / zoom + position[0],
            ((window.innerHeight - e.y) - window.innerHeight / 2) / zoom + position[1]
        ];
        if (!mouseDown){
            return;
        }
        position[0] += -e.movementX / zoom;
        position[1] += e.movementY / zoom;
    });
    element.addEventListener("mousedown", function(e){
        mouseDown = true;
    });
    element.addEventListener("mouseup", function(e){
        mouseDown = false;
    });
    element.addEventListener("wheel", function(e){
        if (e.deltaY < 0){
            zoomIn = true;
        }
        if (e.deltaY > 0){
            zoomOut = true;
        }
    });
    element.addEventListener("keyup", function(e){
        if (e.key == "w"){
            upKey = false;
        }
        if (e.key == "s"){
            downKey = false;
        }
        if (e.key == "d"){
            rightKey = false;
        }
        if (e.key == "a"){
            leftKey = false;
        }
    });
}

function init(){

    
    canvas = document.getElementById("canvas");
    function resizeCanvas(){
        if (!canvas) {
            return;
        }
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    addListeners(canvas);
    slider2d = new Slider2d(document.getElementById("2dslider"));

    loadShader("/mains.vs.glsl", function(err, vertexShader){
        if (err){
            throw Error(`An error ocurred: '${err}'`);
        } else {
            loadShader("/mains.fs.glsl", function(err, fragmentShader){
                if (err){
                    throw Error(`An error ocurred: '${err}'`);
                } else {
                    run(vertexShader, fragmentShader);
                }
            });
        }
    });
    
}

function run(vertexShader, fragmentShader){

    gl = canvas.getContext("webgl");

    //Creatign and assigning shaders

    let vs = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs, vertexShader);
    gl.compileShader(vs);
    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)){
        console.error(
            "Vertex shader compile error: ",
            gl.getShaderInfoLog(vs)
        );
    }

    let fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs, fragmentShader);
    gl.compileShader(fs);
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)){
        console.error(
            "Fragment shader compile error: ",
            gl.getShaderInfoLog(fs)
        );
    }

    //Creating program
    let program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)){
        console.error(
            "Shader program link error: ",
            gl.getShaderInfoLog(program)
        );
    }
    
    gl.validateProgram(program);
    if (!gl.getProgramParameter(program, gl.VALIDATE_STATUS)){
        console.error(
            "Shader program validate error: ",
            gl.getShaderInfoLog(program)
        );
    }

    gl.useProgram(program);

    //Getting uniform locations
    let uniforms = {
        viewportDimentions: gl.getUniformLocation(program, "viewportDimensions"),
        position: gl.getUniformLocation(program, "position"),
        zoom: gl.getUniformLocation(program, "zoom"),
        maxIterations: gl.getUniformLocation(program, "maxIterations"),
        offset: gl.getUniformLocation(program, "offset"),
        useStaticC: gl.getUniformLocation(program, "useStaticC"),
        staticC: gl.getUniformLocation(program, "staticC"),
    }

    //Set CPU-side variables for all of our shader variables
    let vpDimensions = [canvas.width, canvas.height];

    //Create buffers
    let vertexBuffer = gl.createBuffer();
    let vertices = [
        -1, 1,
        -1, -1,
        1, -1,

        -1, 1,
        1, 1,
        1, -1
    ];
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

    var vPosAttrib = gl.getAttribLocation(program, "vPos");
    gl.vertexAttribPointer(
        vPosAttrib,
        2, gl.FLOAT,
        false,
        2 * Float32Array.BYTES_PER_ELEMENT,
        0
    );
    gl.enableVertexAttribArray(vPosAttrib);

    function renderLoop(){
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clear(gl.DEPTH_BUFFER_BIT | gl.COLOR_BUFFER_BIT);
        gl.viewport(0, 0, canvas.width, canvas.height);

        vpDimensions = [canvas.width, canvas.height];

        let zoomS = 0.05;
        if (!(zoomIn && zoomOut)){
            if (zoomIn){
                position[0] = lerp(position[0], mousePosition[0], zoomS);
                position[1] = lerp(position[1], mousePosition[1], zoomS);
                zoom *= 1 + zoomS;
                zoomIn = false;
            }
            if (zoomOut){
                position[0] = lerp(position[0], mousePosition[0], -zoomS);
                position[1] = lerp(position[1], mousePosition[1], -zoomS);
                zoom *= 1/(1 + zoomS);
                zoomOut = false;
            }
        }

        gl.uniform2fv(uniforms.viewportDimentions, vpDimensions);
        gl.uniform2fv(uniforms.position, position);
        gl.uniform1f(uniforms.zoom, zoom);
        gl.uniform1i(uniforms.maxIterations, maxIterations);
        gl.uniform1f(uniforms.offset, offset);
        if (offsetOT){
            offset += 2;
            offset = offset % 360;
            slider_o.value = `${offset}`;
        }
        gl.uniform1f(uniforms.useStaticC, useJuliasset);
        gl.uniform2fv(uniforms.staticC, slider2d.value);

        gl.drawArrays(gl.TRIANGLES, 0, 6);

        requestAnimationFrame(renderLoop);
    }
    requestAnimationFrame(renderLoop);

}

class Slider2d {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = this.canvas.getContext("2d");

        this.valueInfoElement = document.getElementById("cValue");

        this.showSlider(false);

        this.value = [0, 0];

        this.maxValue = 1;

        this.mouseDown = false;

        this.drawCursor();
        this.updateValueInfo();
        
        canvas.addEventListener("mousemove", function (e) {
            if (!slider2d.mouseDown){
                return;
            }
            slider2d.value = [
                (e.layerX - slider2d.canvas.width / 2) / (slider2d.canvas.width / 2) * slider2d.maxValue,
                ((slider2d.canvas.height - e.layerY) - slider2d.canvas.height / 2)
                    / (slider2d.canvas.height / 2) * slider2d.maxValue
            ];
            slider2d.drawCursor();
            slider2d.updateValueInfo();
        });
        canvas.addEventListener("mousedown", function(e){
            if (e.which == 1){
                slider2d.mouseDown = true;
            }
        });
        canvas.addEventListener("mouseup", function(e){
            if (e.which == 1){
                slider2d.mouseDown = false;
            }
        });
    }

    drawCursor() {
        this.ctx.clearRect(0, 0, canvas.width, canvas.height);
        this.ctx.beginPath();
        this.ctx.fillStyle = "white";
        this.ctx.fillRect(0, 0, canvas.width, canvas.height);
        this.ctx.beginPath();
        this.ctx.strokeStyle = "black";
        this.ctx.lineWidth = 2;
        this.ctx.arc(
            this.canvas.width / 2 + this.value[0] / this.maxValue * this.canvas.width / 2,
            this.canvas.height / 2 - this.value[1] / this.maxValue * this.canvas.height / 2,
            4, 0, 7
        );
        this.ctx.stroke();
    }

    updateValueInfo(){
        this.valueInfoElement.innerHTML = `C = ${this.value[0]} ${
            (this.value[1] < 0) ? "-" : "+"
        } ${Math.abs(this.value[1])}i`;
    }

    showSlider(bool){
        if (bool){
            this.canvas.style.display = "inline";
            this.valueInfoElement.style.display = "inline";
        } else {
            this.canvas.style.display = "none";
            this.valueInfoElement.style.display = "none";
        }
    }
}

function lerp(start, end, amount) {
    return (1-amount)*start+amount*end;
}
