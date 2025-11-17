let logoSketch;

function setup() {
    let canvas = createCanvas(windowWidth, windowHeight); // Responsive canvas size
    canvas.parent('p5-canvas-container'); // Attach canvas to its container
    colorMode(HSB, 360, 100, 100, 1);
    
    logoSketch = new MoodscapeLogo();
    logoSketch.setup();
}

function draw() {
    logoSketch.draw();
}

function windowResized() {
    resizeCanvas(windowWidth * 0.8, windowHeight * 0.8);
    logoSketch.onResize();
}

class MoodscapeLogo {
    constructor() {
        this.particles = [];
        this.numParticles = 300; // More particles for density and text formation
        this.logoText = "MOODSCAPE";
        this.textFont = 'Arial'; // A classic, clear font
        this.logoGraphic; // p5.Graphics object to draw text off-screen
        this.textPoints = []; // Stores points on the text outline

        this.palette = {
            bg: '#0a0a0a',
            // Metallic palette using hex codes
            particleColors: [
                '#F8F8F8', // White (near-white)
                '#C0C0C0', // Silver
                '#808080', // Grey
                '#FFFFFF'  // Gold
            ]
        };

        this.introDuration = 3000; // ms for abstract phase
        this.formDuration = 4000; // ms for particles to form text
        this.animationStartTime;

        this.zOff = 0; // Perlin noise Z offset

        this.logoFormed = false; // Flag for UI elements
        this.particleFadeDuration = 1000; // ms for particles to fade out after reaching target
    }

    setup() {
        background(this.palette.bg);
        this.animationStartTime = millis();

        // Create an off-screen graphic for the text
        this.logoGraphic = createGraphics(width, height);
        this.logoGraphic.pixelDensity(1); // Important for consistent point sampling
        this.logoGraphic.textFont(this.textFont);
        this.logoGraphic.textSize(min(width, height) * 0.15); // Dynamic text size
        this.logoGraphic.textAlign(CENTER, CENTER);
        this.logoGraphic.fill(255); // Draw text in white
        this.logoGraphic.noStroke();

        this.createParticles();
        this.generateTextPoints();
    }

    createParticles() {
        this.particles = [];
        for (let i = 0; i < this.numParticles; i++) {
            // Assign a target point from the text when particles are created
            let targetPoint = null;
            if (this.textPoints.length > 0) {
                targetPoint = this.textPoints[i % this.textPoints.length];
            }
            // Randomly select one of the metallic colors for each particle
            const chosenColorHex = random(this.palette.particleColors);

            this.particles.push(new LogoParticle(
                random(-width / 2, width / 2),
                random(-height / 2, height / 2),
                this.palette, // Still pass the whole palette object
                this, // Pass reference to parent sketch
                targetPoint, // Pass the fixed target point
                chosenColorHex // Pass the chosen hex color
            ));
        }
    }

    generateTextPoints() {
        // Redraw text to the graphic
        this.logoGraphic.background(0, 0); // Clear with transparency
        this.logoGraphic.text(this.logoText, this.logoGraphic.width / 2, this.logoGraphic.height / 2);

        // Sample points from the rendered text
        this.logoGraphic.loadPixels();
        this.textPoints = [];
        let gap = 10; // Density of points sampled from text
        for (let x = 0; x < this.logoGraphic.width; x += gap) {
            for (let y = 0; y < this.logoGraphic.height; y += gap) {
                let index = (x + y * this.logoGraphic.width) * 4;
                if (this.logoGraphic.pixels[index + 3] > 0) { // Check alpha channel for visible pixel
                    // Store normalized coordinates (centered)
                    this.textPoints.push(createVector(x - width / 2, y - height / 2));
                }
            }
        }
        console.log(`Generated ${this.textPoints.length} text points.`);
    }

    draw() {
        // Corrected line: Create a p5.Color object from the hex string, then apply alpha
        let bgColor = color(this.palette.bg); // Convert hex string to p5.Color object
        background(hue(bgColor), saturation(bgColor), brightness(bgColor), 0.1); // Now pass HSB components with alpha

        translate(width / 2, height / 2); // Center drawing

        let elapsedTime = millis() - this.animationStartTime;
        let animationPhase; // 0: abstract, 1: forming, 2: formed

        if (elapsedTime < this.introDuration) {
            animationPhase = 0;
        } else if (elapsedTime < this.introDuration + this.formDuration) {
            animationPhase = 1;
        } else {
            animationPhase = 2;
            if (!this.logoFormed) {
                this.logoFormed = true;
                this.showUIElements();
            }
        }

        this.zOff += 0.005; // General noise evolution

        // Update and display particles
        for (let i = 0; i < this.particles.length; i++) {
            let particle = this.particles[i];
            
            // Particles fade out once the logo is "formed"
            if (animationPhase === 2) {
                particle.startFadeOut(millis());
            }

            particle.update(this.zOff, animationPhase);
            particle.show();
        }
    }

    showUIElements() {
        document.getElementById('moodscape-title').classList.remove('hidden');
        document.getElementById('moodscape-title').classList.add('visible');
        
        document.getElementById('moodscape-slogan').classList.remove('hidden');
        document.getElementById('moodscape-slogan').classList.add('visible');

        document.getElementById('enter-button-container').classList.remove('hidden');
        document.getElementById('enter-button-container').classList.add('visible');
    }

    onResize() {
        // Recalculate canvas size based on new window dimensions
        resizeCanvas(windowWidth * 0.8, windowHeight * 0.8);
        this.setup(); // Re-setup to adjust text graphic and particle positions
    }
}


class LogoParticle {
    constructor(x, y, palette, parentSketch, targetPoint, initialColorHex) { // Added initialColorHex
        this.pos = createVector(x, y);
        this.vel = createVector(0, 0);
        this.acc = createVector(0, 0);
        this.maxSpeed = 2; // Initial max speed
        this.size = random(2, 5);
        this.palette = palette;
        this.parent = parentSketch; // Reference to parent sketch

        this.target = targetPoint; // Assign the fixed target point
        this.hasReachedTarget = false; // New flag
        this.fadeStartTime = 0; // When fade out begins
        
        this.baseColor = color(initialColorHex); // Store the chosen hex color as a p5.Color object
        this.id = random(10000); // Unique ID for noise calculations for subtle shimmer
    }

    startFadeOut(currentTime) {
        if (!this.fadeStartTime && this.hasReachedTarget) {
            this.fadeStartTime = currentTime;
        }
    }

    update(zOff, animationPhase) {
        let currentMaxSpeed = this.maxSpeed;
        let flowFieldStrength = 0.005;

        // Skip update if already fully faded
        if (this.fadeStartTime && millis() - this.fadeStartTime > this.parent.particleFadeDuration) {
            this.pos.set(-10000, -10000); // Move off-screen
            return; 
        }

        if (animationPhase === 0) { // Abstract phase
            currentMaxSpeed = map(this.parent.introDuration - (millis() - this.parent.animationStartTime), 0, this.parent.introDuration, 1, this.maxSpeed);
            // General chaotic flow
            let xOff = this.pos.x * flowFieldStrength;
            let yOff = this.pos.y * flowFieldStrength;
            let angle = noise(xOff, yOff, zOff + this.id) * 360 * 2;
            let force = p5.Vector.fromAngle(angle);
            this.acc.add(force.setMag(0.1));
        } else if (animationPhase === 1) { // Forming phase
            if (this.target && !this.hasReachedTarget) { // Only move if not reached
                currentMaxSpeed = map(millis() - (this.parent.animationStartTime + this.parent.introDuration), 0, this.parent.formDuration, 3, 0.5); // Faster then slow down to target
                
                let steer = p5.Vector.sub(this.target, this.pos);
                let distance = steer.mag();
                if (distance < 5) { // Arrived at target
                    this.vel.mult(0);
                    this.acc.mult(0);
                    this.pos.set(this.target);
                    this.hasReachedTarget = true; // Mark as reached
                    currentMaxSpeed = 0; 
                } else {
                    steer.setMag(currentMaxSpeed);
                    this.acc.add(steer.sub(this.vel).mult(0.1)); // Steering behavior
                }
            } else if (this.hasReachedTarget) {
                currentMaxSpeed = 0; // Stop
            }
        } else if (animationPhase === 2) { // Formed phase (now fading)
             currentMaxSpeed = 0; // No movement
        }


        this.vel.add(this.acc);
        this.vel.limit(currentMaxSpeed);
        this.pos.add(this.vel);
        this.acc.mult(0.9); // Apply damping

        // Wrap particles if they go off screen during abstract phase
        if (animationPhase === 0) {
            if (this.pos.x < -width / 2) this.pos.x = width / 2;
            if (this.pos.x > width / 2) this.pos.x = -width / 2;
            if (this.pos.y < -height / 2) this.pos.y = height / 2;
            if (this.pos.y > height / 2) this.pos.y = -height / 2;
        }
    }

    show() {
        let particleAlpha = 0.8;
        if (this.fadeStartTime) {
            let fadeProgress = map(millis() - this.fadeStartTime, 0, this.parent.particleFadeDuration, 1, 0);
            particleAlpha = constrain(fadeProgress * 0.8, 0, 0.8); // Fade from current alpha
        }
        
        // Skip drawing if fully faded
        if (particleAlpha <= 0.01) return;

        // Apply subtle brightness/saturation jitter to the base color
        let h = hue(this.baseColor);
        let s = saturation(this.baseColor);
        let b = brightness(this.baseColor);

        // Add subtle noise-based flicker for shimmer effect
        s = constrain(s + map(noise(this.id, this.parent.zOff * 0.5), 0, 1, -10, 10), 0, 100);
        b = constrain(b + map(noise(this.id, this.parent.zOff * 0.5 + 1000), 0, 1, -10, 10), 0, 100);


        let finalParticleColor = color(h, s, b, particleAlpha); 

        noStroke();
        fill(finalParticleColor);
        ellipse(this.pos.x, this.pos.y, this.size);
    }
}