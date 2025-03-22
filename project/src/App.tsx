import React, { useEffect, useState, useCallback } from 'react';
import { Play, Crown, Coins, Scale, Heart, Wind, Home, Trophy, Sword, Shield } from 'lucide-react';

const GRAVITY = 0.6;
const JUMP_FORCE = -10;
const BASE_GAME_SPEED = 5;
const MIN_TOWER_SPACING = 200;
const MAX_TOWER_SPACING = 300;
const COIN_FADE_DURATION = 500;
const METERS_PER_FRAME = 0.05;
const CLOUD_SPEED = 0.5;
const CLOUD_SPAWN_CHANCE = 0.02;
const BIRD_SPAWN_CHANCE = 0.005;
const EAGLE_SPAWN_CHANCE = 0.015;
const SPEED_BOOST_MULTIPLIER = 1.5;

const jumpSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3');
const coinSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2003/2003-preview.mp3');
const purchaseSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2580/2580-preview.mp3');
const boostSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2886/2886-preview.mp3');
const deathSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2658/2658-preview.mp3');
const resurrectSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2588/2588-preview.mp3');
const errorSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2572/2572-preview.mp3');
const birdSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2516/2516-preview.mp3');
const eagleSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2654/2654-preview.mp3');
jumpSound.volume = 0.3;
coinSound.volume = 1;
purchaseSound.volume = 0.3;
boostSound.volume = 0.3;
deathSound.volume = 0.4;
resurrectSound.volume = 0.3;
errorSound.volume = 0.3;
birdSound.volume = 0.1;
eagleSound.volume = 0.2;

interface GameObject {
  x: number;
  y: number;
  width: number;
  height: number;
  isPurple?: boolean;
  hasCoin?: boolean;
  coinFading?: boolean;
}

interface Cloud {
  x: number;
  y: number;
  speed: number;
  scale: number;
  opacity: number;
}

interface Bird {
  x: number;
  y: number;
  speed: number;
  scale: number;
  direction: number;
  chirping: boolean;
}

interface Eagle {
  x: number;
  y: number;
  speed: number;
  width: number;
  height: number;
}

function App() {
  const [gameStarted, setGameStarted] = useState(false);
  const [meters, setMeters] = useState(0);
  const [tfc, setTfc] = useState(0);
  const [finalTfc, setFinalTfc] = useState(0);
  const [balance, setBalance] = useState(() => {
    const saved = localStorage.getItem('tfcBalance');
    return saved ? parseFloat(saved) : 0;
  });
  const [highScore, setHighScore] = useState(0);
  const [knightEntrance, setKnightEntrance] = useState(true);
  const [extraLives, setExtraLives] = useState(0);
  const [isResurrecting, setIsResurrecting] = useState(false);
  const [isSpeedBoostActive, setIsSpeedBoostActive] = useState(false);
  const [knight, setKnight] = useState<GameObject>({
    x: -100,
    y: 240,
    width: 60,
    height: 60,
  });
  const [velocity, setVelocity] = useState(0);
  const [obstacles, setObstacles] = useState<GameObject[]>([]);
  const [eagles, setEagles] = useState<Eagle[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [showGameOver, setShowGameOver] = useState(false);
  const [nextTowerX, setNextTowerX] = useState(400);
  const [showPurchaseError, setShowPurchaseError] = useState('');
  const [sunPosition, setSunPosition] = useState(0);
  const [clouds, setClouds] = useState<Cloud[]>([]);
  const [birds, setBirds] = useState<Bird[]>([]);

  const gameSpeed = isSpeedBoostActive ? BASE_GAME_SPEED * SPEED_BOOST_MULTIPLIER : BASE_GAME_SPEED;

  const saveTfcBalance = useCallback((newBalance: number) => {
    localStorage.setItem('tfcBalance', newBalance.toString());
  }, []);

  const jump = useCallback(() => {
    if (knight.y === 240 || obstacles.some(obs => 
      obs.isPurple &&
      knight.x + knight.width > obs.x && 
      knight.x < obs.x + obs.width && 
      Math.abs(knight.y + knight.height - obs.y) < 5
    )) {
      setVelocity(JUMP_FORCE);
      jumpSound.currentTime = 0;
      jumpSound.play().catch(err => console.log('Audio play failed:', err));
    }
  }, [knight, obstacles]);

  const handleKeyPress = useCallback((e: KeyboardEvent) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      if (knightEntrance) {
        setKnightEntrance(false);
      } else {
        jump();
      }
    }
  }, [jump, knightEntrance]);

  useEffect(() => {
    if (gameOver) {
      if (extraLives > 0) {
        setIsResurrecting(true);
        setExtraLives(prev => prev - 1);
        resurrectSound.currentTime = 0;
        resurrectSound.play().catch(err => console.log('Audio play failed:', err));
        
        setTimeout(() => {
          setGameOver(false);
          setIsResurrecting(false);
          setKnight(prev => ({
            ...prev,
            y: 240
          }));
          setVelocity(0);
        }, 1000);
      } else {
        const newBalance = balance + tfc;
        setFinalTfc(tfc);
        setBalance(newBalance);
        saveTfcBalance(newBalance);
        setTfc(0);
        
        deathSound.currentTime = 0;
        deathSound.play().catch(err => console.log('Audio play failed:', err));
        setTimeout(() => setShowGameOver(true), 1000);
      }
    } else {
      setShowGameOver(false);
      setFinalTfc(0);
    }
  }, [gameOver, balance, tfc, saveTfcBalance, extraLives]);

  useEffect(() => {
    if (!gameStarted) return;

    const gameLoop = setInterval(() => {
      if (knightEntrance) {
        setKnight(prev => ({
          ...prev,
          x: Math.min(prev.x + 5, 50)
        }));
        return;
      }

      if (gameOver && !isResurrecting) return;

      // Update eagles
      setEagles(prevEagles => {
        const newEagles = prevEagles
          .map(eagle => ({
            ...eagle,
            x: eagle.x - (eagle.speed + gameSpeed)
          }))
          .filter(eagle => eagle.x > -100);

        // Spawn new eagles
        if (Math.random() < EAGLE_SPAWN_CHANCE && !knightEntrance) {
          const lastEagle = newEagles[newEagles.length - 1];
          const lastObstacle = obstacles[obstacles.length - 1];
          
          // Only spawn if there's enough space from the last obstacle and eagle
          if ((!lastEagle || lastEagle.x < 600) && (!lastObstacle || lastObstacle.x < 600)) {
            eagleSound.currentTime = 0;
            eagleSound.play().catch(err => console.log('Audio play failed:', err));
            
            newEagles.push({
              x: 850,
              y: Math.random() * 150 + 100,
              speed: 3 + Math.random() * 2,
              width: 80,
              height: 40
            });
          }
        }

        return newEagles;
      });

      setKnight(prevKnight => {
        let newY = prevKnight.y + velocity;
        let newVelocity = velocity + GRAVITY;

        if (newY >= 240) {
          newY = 240;
          newVelocity = 0;
        }

        // Check collision with eagles
        eagles.forEach(eagle => {
          const knightHitbox = {
            left: prevKnight.x + 10,
            right: prevKnight.x + prevKnight.width - 10,
            top: newY + 10,
            bottom: newY + prevKnight.height - 10
          };

          const eagleHitbox = {
            left: eagle.x + 10,
            right: eagle.x + eagle.width - 10,
            top: eagle.y + 10,
            bottom: eagle.y + eagle.height - 10
          };

          if (
            !isResurrecting &&
            knightHitbox.right > eagleHitbox.left &&
            knightHitbox.left < eagleHitbox.right &&
            knightHitbox.bottom > eagleHitbox.top &&
            knightHitbox.top < eagleHitbox.bottom
          ) {
            setGameOver(true);
          }
        });

        obstacles.forEach(obs => {
          const knightHitbox = {
            left: prevKnight.x + 10,
            right: prevKnight.x + prevKnight.width - 10,
            top: newY + 10,
            bottom: newY + prevKnight.height - 10
          };

          const obsHitbox = {
            left: obs.x,
            right: obs.x + obs.width,
            top: obs.y,
            bottom: obs.y + obs.height
          };

          if (
            !isResurrecting &&
            knightHitbox.right > obsHitbox.left &&
            knightHitbox.left < obsHitbox.right &&
            knightHitbox.bottom > obsHitbox.top &&
            knightHitbox.top < obsHitbox.bottom
          ) {
            const fallingOnTop = velocity > 0 && 
              knightHitbox.bottom >= obsHitbox.top &&
              knightHitbox.bottom <= obsHitbox.top + 20 &&
              knightHitbox.top < obsHitbox.top;

            if (fallingOnTop) {
              newY = obs.y - prevKnight.height + 10;
              newVelocity = 0;
            } else {
              setGameOver(true);
            }
          }
        });

        setVelocity(newVelocity);
        return {
          ...prevKnight,
          y: newY
        };
      });

      setObstacles(prev => {
        const newObstacles = prev
          .map(obs => {
            if (obs.hasCoin && !obs.coinFading) {
              const coinHitbox = {
                left: obs.x,
                right: obs.x + obs.width,
                top: obs.y - 60,
                bottom: obs.y,
              };
              
              const knightHitbox = {
                left: knight.x + 10,
                right: knight.x + knight.width - 10,
                top: knight.y + 10,
                bottom: knight.y + knight.height - 10,
              };

              if (
                knightHitbox.right > coinHitbox.left &&
                knightHitbox.left < coinHitbox.right &&
                knightHitbox.bottom > coinHitbox.top &&
                knightHitbox.top < coinHitbox.bottom
              ) {
                setTfc(t => t + 0.1);
                coinSound.currentTime = 0;
                coinSound.play().catch(err => console.log('Audio play failed:', err));
                return { ...obs, hasCoin: false, coinFading: true };
              }
            }
            return { ...obs, x: obs.x - gameSpeed };
          })
          .filter(obs => obs.x > -50);

        if (newObstacles.length < 5) {
          const randomHeight = Math.floor(Math.random() * 41) + 40;
          const isPurple = Math.random() < 0.3;
          
          // Check if there's an eagle nearby
          const lastEagle = eagles[eagles.length - 1];
          if (!lastEagle || lastEagle.x < nextTowerX - 100) {
            newObstacles.push({
              x: nextTowerX,
              y: 300 - randomHeight,
              width: 30,
              height: randomHeight,
              isPurple,
              hasCoin: isPurple,
            });

            const spacing = Math.floor(Math.random() * (MAX_TOWER_SPACING - MIN_TOWER_SPACING)) + MIN_TOWER_SPACING;
            setNextTowerX(nextTowerX + spacing);
          }
        }

        return newObstacles;
      });

      if (!knightEntrance) {
        setMeters(prev => prev + METERS_PER_FRAME * (isSpeedBoostActive ? SPEED_BOOST_MULTIPLIER : 1));
      }
    }, 1000 / 60);

    window.addEventListener('keydown', handleKeyPress);

    return () => {
      clearInterval(gameLoop);
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [gameStarted, velocity, knight, obstacles, handleKeyPress, meters, gameOver, nextTowerX, jump, knightEntrance, isSpeedBoostActive, gameSpeed, isResurrecting, eagles]);

  const showError = (message: string) => {
    errorSound.currentTime = 0;
    errorSound.play().catch(err => console.log('Audio play failed:', err));
    setShowPurchaseError(message);
    setTimeout(() => setShowPurchaseError(''), 2000);
  };

  const purchaseExtraLife = () => {
    if (balance >= 1) {
      const newBalance = balance - 1;
      setBalance(newBalance);
      saveTfcBalance(newBalance);
      setExtraLives(prev => prev + 1);
      purchaseSound.currentTime = 0;
      purchaseSound.play().catch(err => console.log('Audio play failed:', err));
    } else {
      showError('Pas assez de TFC pour une vie supplémentaire !');
    }
  };

  const purchaseSpeedBoost = () => {
    if (balance >= 1) {
      const newBalance = balance - 1;
      setBalance(newBalance);
      saveTfcBalance(newBalance);
      setIsSpeedBoostActive(true);
      boostSound.currentTime = 0;
      boostSound.play().catch(err => console.log('Audio play failed:', err));
    } else {
      showError('Pas assez de TFC pour le boost de vitesse !');
    }
  };

  const resetGame = () => {
    deathSound.pause();
    deathSound.currentTime = 0;
    setGameStarted(true);
    setGameOver(false);
    setShowGameOver(false);
    setMeters(0);
    setTfc(0);
    setFinalTfc(0);
    setKnight({
      x: 50,
      y: 240,
      width: 60,
      height: 60,
    });
    setVelocity(0);
    setObstacles([]);
    setEagles([]);
    setNextTowerX(400);
    setKnightEntrance(true);
    setIsSpeedBoostActive(false);
    setIsResurrecting(false);
    setClouds([]);
    setBirds([]);
  };

  const returnToHome = () => {
    deathSound.pause();
    deathSound.currentTime = 0;
    setGameStarted(false);
    setGameOver(false);
    setShowGameOver(false);
    setMeters(0);
    setTfc(0);
    setFinalTfc(0);
    setKnight({
      x: -100,
      y: 240,
      width: 60,
      height: 60,
    });
    setVelocity(0);
    setObstacles([]);
    setEagles([]);
    setNextTowerX(400);
    setKnightEntrance(true);
    setIsSpeedBoostActive(false);
    setIsResurrecting(false);
    setClouds([]);
    setBirds([]);
  };

  return (
    <div className="h-screen bg-gradient-to-b from-gray-900 to-black flex items-center justify-center relative overflow-hidden">

<div className="absolute inset-0 bg-[url('https://i.imgur.com/JokPe6U_d.webp?maxwidth=760&fidelity=grand')] bg-cover bg-center opacity-20" />
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute w-full h-full bg-[url('https://images.unsplash.com/photo-1578662996442-48f60103fc96')] bg-cover opacity-10" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-gray-900/50 to-black/70" />
      </div>

      {!gameStarted ? (
        <div className="relative text-center panel-medieval p-8 rounded-2xl max-w-2xl w-full mx-4 transform hover:scale-[1.02] transition-all duration-300">
          <div className="absolute -top-6 left-1/2 transform -translate-x-1/2">
            <img 
              src="https://i.imgur.com/IzIRcsl_d.webp?maxwidth=760&fidelity=grand" 
              alt="TFC coin" 
              className="w-16 h-16 animate-pulse"
            />
          </div>

          <h1 className="medieval-title text-4xl font-bold mb-4 text-red-600 mt-4">
            The French Conquistor
            <span className="block text-xl mt-1 text-gray-400">Conquérir le monde</span>
          </h1>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="panel-medieval p-4 rounded-xl">
              <div className="flex items-center justify-center gap-2 text-gray-300 mb-1">
                <Trophy className="w-5 h-5 text-yellow-600" />
                <span className="text-lg font-semibold">High Score</span>
              </div>
              <p className="text-xl font-bold text-yellow-600">{highScore.toFixed(2)}m</p>
            </div>

            <div className="panel-medieval p-4 rounded-xl">
              <div className="flex items-center justify-center gap-2 text-gray-300 mb-1">
                <Coins className="w-5 h-5 text-yellow-600" />
                <span className="text-lg font-semibold">Balance</span>
              </div>
              <p className="text-xl font-bold text-yellow-600">{balance.toFixed(2)} TFC</p>
            </div>
          </div>

          <div className="space-y-4 mb-6">
            <div className="panel-medieval p-4 rounded-xl">
              <h2 className="medieval-title text-xl font-bold text-red-600 mb-3 flex items-center justify-center gap-2">
                <Sword className="w-5 h-5" />
                Power Ups
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={purchaseExtraLife}
                  className="btn-medieval group text-white px-4 py-3 rounded-xl flex items-center justify-center gap-2"
                >
                  <Heart className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  <div className="text-left">
                    <div className="font-semibold text-sm">Extra Life</div>
                    <div className="text-xs opacity-90">1 TFC</div>
                  </div>
                </button>
                <button
                  onClick={purchaseSpeedBoost}
                  className="btn-medieval group text-white px-4 py-3 rounded-xl flex items-center justify-center gap-2"
                >
                  <Wind className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  <div className="text-left">
                    <div className="font-semibold text-sm">Speed Boost</div>
                    <div className="text-xs opacity-90">1 TFC</div>
                  </div>
                </button>
              </div>
            </div>

            <div className="panel-medieval p-4 rounded-xl">
              <h2 className="medieval-title text-xl font-bold text-red-600 mb-3 flex items-center justify-center gap-2">
                <Shield className="w-5 h-5" />
                Comment jouer
              </h2>
              <div className="text-gray-300 space-y-1 text-left text-sm">
                <p className="flex items-center gap-2">
                  <span className="bg-red-900/50 px-2 py-0.5 rounded text-xs">ESPACE</span>
                  pour sauter
                </p>
                <p className="flex items-center gap-2">
                  <Coins className="w-4 h-4 text-yellow-600" />
                  Collectez des TFC
                </p>
                <p className="flex items-center gap-2">
                  <Crown className="w-4 h-4 text-yellow-600" />
                  Battez votre record
                </p>
              </div>
            </div>
          </div>

          {(extraLives > 0 || isSpeedBoostActive) && (
            <div className="panel-medieval p-2 rounded-lg mb-4 bg-black/40">
              <div className="flex items-center justify-center gap-4">
                {extraLives > 0 && (
                  <div className="flex items-center gap-1 text-red-500">
                    <Heart className="w-4 h-4" />
                    <span className="text-sm">x{extraLives}</span>
                  </div>
                )}
                {isSpeedBoostActive && (
                  <div className="flex items-center gap-1 text-orange-500">
                    <Wind className="w-4 h-4" />
                    <span className="text-sm">Boost de vitesse</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <button
            onClick={resetGame}
            className="btn-medieval group text-white px-6 py-3 rounded-xl flex items-center justify-center gap-2 w-full"
          >
            <Play className="w-5 h-5 group-hover:scale-110 transition-transform" />
            <span className="text-lg font-bold">Commencer l'aventure</span>
          </button>

          {showPurchaseError && (
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-red-600 text-white px-4 py-2 rounded-lg animate-fade-in">
              {showPurchaseError}
            </div>
          )}
        </div>
      ) : (
        <div className="relative w-[800px] h-[400px] rounded-lg overflow-hidden transition-all duration-1000 bg-gradient-to-b from-[#87CEEB] to-[#1E90FF]">
          <div 
            className="absolute w-20 h-20 rounded-full bg-yellow-300 shadow-lg transition-all duration-300"
            style={{
              left: `${Math.sin(sunPosition * Math.PI / 180) * 300 + 400}px`,
              top: `${Math.cos(sunPosition * Math.PI / 180) * -100 + 120}px`,
              boxShadow: '0 0 50px #fde047, 0 0 100px #fef08a',
              transform: 'translate(-50%, -50%)',
              filter: 'blur(2px)',
              zIndex: 1
            }}
          >
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-yellow-200 to-yellow-400 animate-pulse" />
          </div>

          {clouds.map((cloud, index) => (
            <div
              key={`cloud-${index}`}
              className="absolute"
              style={{
                left: cloud.x,
                top: cloud.y,
                width: 120,
                height: 80,
                backgroundImage: 'url("https://static.vecteezy.com/system/resources/thumbnails/012/595/172/small/realistic-white-cloud-png.png")',
                backgroundSize: 'contain',
                backgroundRepeat: 'no-repeat',
                transform: `scale(${cloud.scale})`,
                opacity: cloud.opacity,
                zIndex: cloud.y < 120 ? 2 : 0,
                filter: 'brightness(0.95)',
              }}
            />
          ))}

          {birds.map((bird, index) => (
            <div
              key={`bird-${index}`}
              className="absolute"
              style={{
                left: bird.x,
                top: bird.y,
                width: 40,
                height: 40,
                backgroundImage: 'url("https://i.imgur.com/IzIRcsl_d.webp?maxwidth=760&fidelity=grand")',
                backgroundSize: 'contain',
                backgroundRepeat: 'no-repeat',
                transform: `scale(${bird.scale}) scaleX(${bird.direction})`,
                zIndex: 2,
                filter: bird.chirping ? 'brightness(1.2)' : 'brightness(1)',
              }}
            />
          ))}

          {eagles.map((eagle, index) => (
            <div
              key={`eagle-${index}`}
              className="absolute"
              style={{
                left: eagle.x,
                top: eagle.y,
                width: eagle.width,
                height: eagle.height,
                backgroundImage: 'url("https://png.pngtree.com/png-clipart/20230412/original/pngtree-flying-eagle-feather-white-background-transparent-png-image_9048176.png")',
                backgroundSize: 'contain',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'center',
                transform: 'scaleX(-1)',
                zIndex: 3
              }}
            />
          ))}

          <div className="absolute top-4 right-4 flex flex-col items-end gap-2 bg-black bg-opacity-30 p-3 rounded-lg z-10">
            <div className="text-white flex items-center gap-2 text-lg">
              <Crown className="text-yellow-300" /> Distance: {meters.toFixed(2)}m
            </div>
            <div className="text-white flex items-center gap-2 text-lg">
              <Coins className="text-yellow-400" /> TFC: {tfc.toFixed(2)}
            </div>
            <div className="text-white flex items-center gap-2 text-lg">
              <Scale className="text-green-400" /> Balance: {(balance + tfc).toFixed(2)}
            </div>
            {extraLives > 0 &&  (
              <div className="text-white flex items-center gap-2 text-lg">
                <Heart className="text-red-500" /> x{extraLives}
              </div>
            )}
            {isSpeedBoostActive && (
              <div className="text-white flex items-center gap-2 text-lg">
                <Wind className="text-orange-500" /> +50% Vitesse
              </div>
            )}
          </div>

          {isSpeedBoostActive && (
            <div className="absolute inset-0 bg-orange-500 bg-opacity-30 animate-pulse pointer-events-none" />
          )}

          <div className="absolute bottom-0 w-full h-[100px] bg-gradient-to-b from-[#4ade80] to-[#16a34a]" />

          {knightEntrance && (
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-white text-2xl font-bold animate-bounce">
              Appuyez sur ESPACE pour commencer
            </div>
          )}

          <div
            className={`absolute transition-transform ${isResurrecting ? 'animate-resurrect' : ''}`}
            style={{
              left: knight.x,
              top: knight.y,
              width: knight.width,
              height: knight.height,
              backgroundImage: 'url("https://i.imgur.com/qoYX8D9_d.webp?maxwidth=760&fidelity=grand")',
              backgroundSize: 'contain',
              backgroundRepeat: 'no-repeat',
              transform: `translateY(${velocity > 0 ? 5 : 0}px)`,
              opacity: gameOver && !isResurrecting ? 0 : 1,
              filter: isResurrecting ? 'brightness(1.5) drop-shadow(0 0 10px gold)' : 'none',
              zIndex: 3
            }}
          />

          {obstacles.map((obstacle, index) => (
            <React.Fragment key={index}>
              {obstacle.isPurple && (
                <div
                  className="absolute"
                  style={{
                    left: obstacle.x - 15,
                    top: obstacle.y - 60,
                    width: 60,
                    height: 60,
                    backgroundImage: 'url("https://i.imgur.com/IzIRcsl_d.webp?maxwidth=760&fidelity=grand")',
                    backgroundSize: 'contain',
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'center',
                    opacity: obstacle.coinFading ? 0 : 1,
                    transition: 'opacity 500ms ease-out',
                    zIndex: 3
                  }}
                />
              )}
              <div
                className={`absolute ${obstacle.isPurple ? 'bg-purple-700' : 'bg-stone-700'}`}
                style={{
                  left: obstacle.x,
                  top: obstacle.y,
                  width: obstacle.width,
                  height: obstacle.height,
                  backgroundImage: obstacle.isPurple 
                    ? 'linear-gradient(to bottom, #7e3af2, #5521b5)'
                    : 'linear-gradient(to bottom, #4a5568, #2d3748)',
                  borderTop: obstacle.isPurple 
                    ? '8px solid #6b21a8'
                    : '8px solid #1a202c',
                  borderRadius: '4px 4px 0 0',
                  zIndex: 3
                }}
              />
            </React.Fragment>
          ))}

          {gameOver && showGameOver && (
            <div className="absolute inset-0 game-over-overlay flex items-center justify-center z-50">
              <div className="bg-gradient-to-b from-gray-900 to-black p-8 rounded-lg text-center relative overflow-hidden">
                <div className="absolute inset-0 bg-red-900 opacity-10 animate-pulse" />
                
                <h2 className="game-over-title text-6xl font-bold mb-8 text-red-600 opacity-0">
                  Game Over!
                </h2>
                
                <div className="space-y-6 mb-8 relative">
                  <div className="game-over-stat flex items-center justify-center gap-3 text-2xl text-gray-200">
                    <Crown className="text-yellow-500" />
                    <span>Distance: <span className="font-bold text-white">{meters.toFixed(2)}m</span></span>
                  </div>
                  
                  <div className="game-over-stat flex items-center justify-center gap-3 text-xl text-gray-300">
                    <Trophy className="text-yellow-600" />
                    <span>Record: <span className="font-bold text-white">{highScore.toFixed(2)}m</span></span>
                  </div>
                  
                  <div className="game-over-stat flex items-center justify-center gap-3 text-xl">
                    <Coins className="text-yellow-400" />
                    <span className="text-yellow-400">TFC Earned: <span className="font-bold">{finalTfc.toFixed(2)}</span></span>
                  </div>
                </div>
                
                <div className="flex gap-4 justify-center">
                  <button
                    onClick={resetGame}
                    className="game-over-button bg-gradient-to-r from-blue-600 to-blue-800 text-white px-6 py-3 rounded-lg flex items-center justify-center gap-2 hover:from-blue-700 hover:to-blue-900 transition-all duration-300 transform hover:scale-105 hover:shadow-lg"
                  >
                    <Play size={24} /> Play Again
                  </button>
                
                  <button
                    onClick={returnToHome}
                    className="game-over-button bg-gradient-to-r from-gray-600 to-gray-800 text-white px-6 py-3 rounded-lg flex items-center justify-center gap-2 hover:from-gray-700 hover:to-gray-900 transition-all duration-300 transform hover:scale-105 hover:shadow-lg"
                  >
                    <Home size={24} /> Return Home
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
