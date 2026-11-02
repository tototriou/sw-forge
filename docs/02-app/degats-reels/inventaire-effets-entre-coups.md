# Dégâts réels — inventaire des effets posés entre les coups

La liste, sort par sort, des sorts des formes que l'Optimizer propose
(`formesJouables`) qui permettent de poser un effet néfaste entre leurs coups,
avec les coups qui posent. La règle qui les produit, ses exceptions et ce qui
est écarté : [feat-poses-entre-les-coups.md](feat-poses-entre-les-coups.md).

Cette liste est figée par `testInventaireEffetsEntreCoups`
([tests/degats-effets-entre-coups.test.ts](../../../tests/degats-effets-entre-coups.test.ts),
fixture [tests/fixtures/effets-entre-coups-inventaire.json](../../../tests/fixtures/effets-entre-coups-inventaire.json)) :
243 sorts, 129 lignes ci-dessous (un même nom aux effets identiques sur une
ligne). Un sort que des données régénérées ajoutent ou retirent fait échouer
le test : relire sa prose, puis mettre à jour la fixture et cette page dans le
même commit.

« Chaque coup » veut dire chaque coup **avant le dernier** : une pose après le
dernier coup ne change rien au sort. « Coup N » : seul ce coup pose l'effet,
réglé par un interrupteur. Plusieurs coups nommés : un sélecteur limité à eux.
Un effet autre que la Réduction de DEF et la Marque n'apparaît que lorsque le
compte des effets nocifs de la cible est lu, par le sort ou par le monstre.

| Sort | Identifiants | Porteurs | Effets proposés |
| --- | --- | --- | --- |
| Air Shot | 18830 | Jaduel and Aepiah ténèbres | Réduction de DEF — chaque coup |
| Amputate | 18001, 18002, 18003, 18004, 18005 | Brita eau, Solveig feu, Astrid vent, Berghild lumière, Sigrid ténèbres | Réduction de DEF — chaque coup |
| Arcane Burst | 23311 | Cecilia eau | Réduction de DEF — chaque coup |
| Axe Technique of the Mercenary Queen | 18007, 18009 | Solveig feu, Berghild lumière | Marque — coup 1 |
| Band of Blades | 23806, 23808, 23810 | Aragorn eau, Aragorn vent, Aragorn ténèbres | Réduction de DEF — chaque coup |
| Big Sigh | 25807, 25808, 25809 | Volcaris feu, Auraris vent, Luminaris lumière | Réduction de DEF — chaque coup |
| Bittersweet Knight | 16915 | Truffle ténèbres | Réduction de DEF — chaque coup |
| Black Meteor | 19615 | Celestara ténèbres | Dégâts continus ×2 — chaque coup |
| Blackout Kick | 3454 | Sia lumière | Réduction de DEF — coup 1 |
| Bond of the Pack | 24306, 24308, 24310 | Night Fang eau, Night Fang vent, Night Fang ténèbres | Réduction de DEF — chaque coup |
| Brand of Hell | 11206, 11209, 11222 | Avaris eau, Amarna lumière, Iunu vent | Marque — chaque coup |
| Brutal Fists | 18301, 18302, 18303, 18304, 18305 | Mayasura eau, Varuna feu, Usha vent, Danu lumière, Vritra ténèbres | Marque — chaque coup |
| Burst Shot | 15915 | Destiny ténèbres | Réduction de DEF — chaque coup |
| Chain Attack | 6158 | Naomi vent | Marque — chaque coup |
| Chain Combo Attack | 14415 | Vancliffe ténèbres | Réduction de DEF — coups 4, 5 (au coup 5, si ce coup retire un effet bénéfique) |
| Check and Destroy | 7406, 7410 | Fedora eau, Dias ténèbres | Réduction de DEF — chaque coup |
| Cleave | 19910 | Ryomen Sukuna ténèbres | Réduction de DEF — chaque coup |
| Coffin Bash | 21106, 21108, 21109 | Mork eau, Gronn vent, Ramon lumière | Réduction de DEF — chaque coup |
| Combo Attack | 11007, 11008, 11009 | Sin feu, Lo vent, Hiro lumière | Réduction de DEF — chaque coup |
| Constant Flux | 21315 | Tanjiro Kamado ténèbres | Réduction de DEF — chaque coup |
| Continuous Slash | 20401, 20402, 20403, 20404, 20405 | Solvark eau, Deragron feu, Ereshion vent, Fridrion lumière, Drakar ténèbres | Réduction de DEF — chaque coup |
| Crazy Cutting | 21514 | Inosuke Hashibira lumière | Réduction de DEF — coup 1 |
| Crumble | 9014 | Asima lumière | Réduction de DEF — chaque coup |
| Crushed Hopes | 10413 | Cichlid vent | Réduction de DEF — coup 2 |
| Crushing Rocks | 4006, 4007, 4008, 4009, 4010 | Tigresse eau, Lamor feu, Samour vent, Varis lumière, Havana ténèbres | Réduction de DEF — chaque coup |
| Curse of the Beautiful | 11306, 11307, 11310 | Bastet eau, Sekhmet feu, Nephthys ténèbres | Réduction de DEF — chaque coup |
| Cursed Energy Kicks | 20106, 20109 | Yuji Itadori eau, Yuji Itadori lumière | Marque — coups 1, 2, 3 |
| Dark Dragon Descent | 21915 | Azure Dragon Swordsman ténèbres | Réduction de DEF — chaque coup |
| Darkslayer Knight | 16415 | Madeleine Cookie ténèbres | Réduction de DEF — chaque coup |
| Deadly Dart | 3457 | Colleen feu | Marque — chaque coup |
| Deadly Touch | 7506, 7508, 7510 | Rigel eau, Fuco vent, Grego ténèbres | Réduction de DEF — chaque coup |
| Deadly Wrath | 11215 | Thebae ténèbres | Marque — chaque coup |
| Death Blow | 6513 | Argen vent | Marque — chaque coup<br>Blocage des effets bénéfiques — chaque coup |
| Death Verdict | 10706, 10707, 10709 | Stella eau, Lexy feu, Natalie lumière | Marque — chaque coup |
| Demolition Ball | 22614 | Paul Phoenix lumière | Marque — coup 2 |
| Desert Predator | 17812 | Ashour feu | Réduction de DEF — chaque coup |
| Destruct Evil | 9211 | Gildong eau | Réduction de DEF — chaque coup |
| Devil's Whip | 6915 | Ran ténèbres | Réduction de DEF — chaque coup |
| Dimension Slash・Flurry | 25706, 25710 | Wieb eau, Wieb ténèbres | Réduction de DEF — coup 1 |
| Divergent Fist | 20107, 20108, 20110 | Yuji Itadori feu, Yuji Itadori vent, Yuji Itadori ténèbres | Réduction de DEF — coup 1 |
| Divine Judgment | 23514 | Arella lumière | Réduction de DEF — chaque coup (si les ennemis ont subi au moins autant de dégâts que les alliés)<br>Marque — chaque coup (si les alliés ont subi plus de dégâts que les ennemis) |
| Double Strike | 12608 | Melissa vent | Réduction de DEF — coup 1 |
| Drill Kick | 14206, 14210 | DHALSIM eau, DHALSIM ténèbres | Réduction de DEF — chaque coup |
| Emission of Dangerous Substance | 14721, 14725 | Kyle eau, Cayde ténèbres | Réduction de DEF — chaque coup |
| Eternal Scar | 9011 | Beth eau | Réduction de DEF — chaque coup |
| Exorcism Orb | 20510 | Hayato ténèbres | Réduction de DEF — chaque coup |
| Exorcist Consecutive Kicks | 20706, 20709 | Rick eau, Rick lumière | Marque — coups 1, 2, 3 |
| Exorcist Shuriken Formation | 20915 | Aya ténèbres | Réduction de DEF — coup 1 |
| Explosive Fist | 22807 | Daimon feu | Réduction de DEF — chaque coup |
| Fast Link | 13606, 13607, 13610 | Barbara eau, Masha feu, Xiana ténèbres | Réduction de DEF — coup 1 |
| Fire Strike | 17411 | Kassandra eau | Marque — chaque coup |
| Flame Slash | 8032 | Jun feu | Réduction de DEF — chaque coup |
| Flame Strike | 17911 | Kalantatze eau | Marque — chaque coup |
| Fluttering Kiss Shot | 22706, 22707, 22710 | Nina Williams eau, Nina Williams feu, Nina Williams ténèbres | Réduction de DEF — coup 2 |
| Flying Impact Combo | 23114 | Duke lumière | Marque — coup 2 |
| Focus Shot | 18826 | Ramael and Judiah eau | Réduction de DEF — chaque coup |
| Full Burst | 15315 | ROBO-F29 ténèbres | Dégâts continus — chaque coup |
| Ghost Appearance | 11507, 11509 | Smokey feu, Misty lumière | Réduction de DEF — chaque coup |
| Ghost Slash | 15001, 15002, 15003, 15004, 15005 | Suiki eau, Kaki feu, Fuuki vent, Kinki lumière, Ongyouki ténèbres | Réduction de DEF — chaque coup |
| Gouge | 9009, 9017 | Asima lumière, Beth eau | Dégâts continus — chaque coup |
| Gust | 1153 | Aeilene vent | Étourdissement — chaque coup |
| Hairpin: Black Flash | 20315 | Nobara Kugisaki ténèbres | Réduction de DEF — coup 1 |
| Harpoon Impalement | 17507, 17509 | Eivor feu, Eivor lumière | Marque — coup 1 |
| Horn of the Ancient Beetle | 21715 | Actaeon ténèbres | Marque — chaque coup |
| Killing Wave | 6511 | Liesel eau | Réduction de DEF — chaque coup |
| Light Dragon Frenzy | 21914 | Azure Dragon Swordsman lumière | Marque — chaque coup |
| Lightning Storm | 19113 | Yennefer vent | Marque — chaque coup |
| Mach Crush | 10013 | Akhamamir vent | Irrécupérable — chaque coup |
| Magic Shot | 10606, 10610 | Lapis eau, Lanett ténèbres | Réduction de DEF — chaque coup |
| Mana Particle Cannon・Barrage | 25506, 25508, 25510 | Luen eau, Luen vent, Luen ténèbres | Réduction de DEF — chaque coup |
| Meteor Strike | 19215 | Triss ténèbres | Dégâts continus ×2 — chaque coup |
| Necromancy: Knights | 21011 | Lamiella eau | Marque — chaque coup |
| Night Crow | 15107, 15109 | Coco feu, Dorothy lumière | Marque — chaque coup |
| Nimble Assault | 17207, 17208, 17210 | Ezio feu, Ezio vent, Ezio ténèbres | Réduction de DEF — chaque coup |
| Overcharge Axe | 25614 | Schporte lumière | Réduction de DEF — chaque coup |
| Panda Supremacy | 12012 | Xiong Fei feu | Chances de coup glancing augmentées — chaque coup<br>Réduction d’ATQ — chaque coup<br>Réduction de VIT — chaque coup<br>Irrécupérable — chaque coup |
| Phantom Light | 2212 | Shihwa feu | Marque — chaque coup |
| Phoenix Kick | 8113 | Huan vent | Réduction de DEF — chaque coup |
| Pierce Soul | 11219 | Amarna lumière | Réduction de DEF — chaque coup |
| Poisonous Teeth | 8701, 8702, 8703, 8704, 8705 | Kernodon eau, Igmanodon feu, Velfinodon vent, Glinodon lumière, Devinodon ténèbres | Réduction de DEF — chaque coup |
| PPK Combo | 13915 | RYU ténèbres | Réduction de DEF — coups 4, 5 (au coup 5, si ce coup retire un effet bénéfique) |
| Pride Will Fall | 9112 | Hwahee feu | Réduction de DEF — chaque coup |
| Rain of Stones | 10512 | Okeanos feu | Étourdissement — chaque coup |
| Rampage of Rage | 17312 | Bayek feu | Réduction de DEF — chaque coup |
| Rat Hunt | 1601, 1602, 1603, 1604, 1605 | Ramira eau, Lucasha feu, Prilea vent, Kabilla lumière, Hellea ténèbres | Réduction de DEF — chaque coup |
| Reelseiden・Flurry | 25206, 25210 | Übel eau, Übel ténèbres | Réduction de DEF — coup 1 |
| Revolver Kick | 23206, 23207, 23210 | Shasha eau, Shasha feu, Shasha ténèbres | Réduction de DEF — coup 2 |
| Roll Dice | 12101, 12102, 12103, 12104, 12105 | Reno eau, Ludo feu, Morris vent, Tablo lumière, Monte ténèbres | Réduction de DEF — chaque coup |
| Run!! | 18722, 18725 | Yeji and Sapsaree feu, Damee and Sapsaree ténèbres | Réduction de DEF — chaque coup |
| Sequential Attack | 12001, 12002, 12003, 12004, 12005 | Mo Long eau, Xiong Fei feu, Feng Yan vent, Tian Lang lumière, Mi Ying ténèbres | Réduction de DEF — chaque coup |
| Shadow Blade | 14512 | Bernadotte feu | Marque — chaque coup |
| Shadowless Movement | 15515 | Maximilian ténèbres | Réduction de DEF — chaque coup |
| Shatter | 9007, 9008, 9016 | Raki feu, Ethna vent, Craka ténèbres | Réduction de DEF — chaque coup |
| Shinryuken | 14012 | KEN feu | Marque — chaque coup |
| Shockwave Fist | 20707, 20708, 20710 | Rick feu, Rick vent, Rick ténèbres | Réduction de DEF — coup 1 |
| Shooting Star | 1361 | Kacey eau | Marque — chaque coup |
| Shred | 5661 | Vigor eau | Réduction de DEF — chaque coup |
| Simple Solution | 4815 | Han ténèbres | Réduction de DEF — chaque coup |
| Spinning Slash | 5513 | Sophia vent | Réduction de DEF — chaque coup |
| Start Battle | 9506, 9507, 9509 | Toma eau, Naki feu, Dona lumière | Réduction de DEF — chaque coup |
| Steel Swordsmanship | 17707, 17708, 17710 | Patrick feu, Hector vent, Evan ténèbres | Réduction de DEF — chaque coup |
| Summon Clouds | 7915 | Son Zhang Lao ténèbres | Réduction de DEF — chaque coup |
| Sun Halo Dragon | 21314 | Tanjiro Kamado lumière | Marque — chaque coup |
| Swirling | 19306, 19307, 19309 | Anders eau, Magnus feu, Lars lumière | Réduction de DEF — chaque coup |
| Tempest Sword | 10613 | Lupinus vent | Marque — chaque coup |
| Thunder God Fist | 22307 | Heihachi Mishima feu | Réduction de DEF — chaque coup |
| Triple Attack | 1212 | Cogma feu | Réduction de DEF — chaque coup (sur coup critique) |
| Triple Combo | 13913 | RYU vent | Réduction de DEF — coups 1, 2 |
| Triple Crush | 10006, 10007, 10009 | Theomars eau, Tesarion feu, Elsharion lumière | Réduction de DEF — chaque coup |
| Triple Crush | 14413 | Kashmir vent | Réduction de DEF — coups 1, 2 |
| Triple Spear Strike | 23407, 23408, 23409 | Agrius feu, Pholus vent, Chiron lumière | Marque — chaque coup |
| Triple Strike | 12706, 12710 | Sabrina eau, Martina ténèbres | Réduction de DEF — chaque coup |
| Vanguard's Combo | 25114 | Stark lumière | Réduction de DEF — chaque coup |
| Vengeance of Thor | 17501, 17502, 17503, 17504, 17505 | Eivor eau, Eivor feu, Eivor vent, Eivor lumière, Eivor ténèbres | Réduction de DEF — chaque coup |
| Violent Friends | 3465 | Seren ténèbres | Réduction de DEF — chaque coup |
| Virus | 19707, 19710 | 7R1X feu, N1X ténèbres | Réduction de DEF — chaque coup (un seul des effets possibles par coup, au hasard) |
| Virus | 19708 | 570RM vent | Réduction de DEF — chaque coup (un seul des effets possibles par coup, au hasard)<br>Réduction de VIT — chaque coup (un seul des effets possibles par coup, au hasard)<br>Blocage des effets bénéfiques — chaque coup (un seul des effets possibles par coup, au hasard) |
| Water Dragon Attack | 8211 | Xiao Lin eau | Réduction de DEF — chaque coup |
| Water Dragon Surge | 21911 | Azure Dragon Swordsman eau | Gel — coup 1 |
| Water Guardian Angel | 7211 | Anavel eau | Réduction de DEF — chaque coup |
| Wave Harpoon | 10312 | Ignicus feu | Réduction de DEF — chaque coup |
| Weakness Shot | 15507, 15508, 15509 | Carlos feu, Dominic vent, Benedict lumière | Marque — coup 1 |
| Whirl | 18906, 18907, 18909 | Geralt eau, Geralt feu, Geralt lumière | Réduction de DEF — chaque coup |
| Whirlpool | 21311 | Tanjiro Kamado eau | Gel — coup 1 |
| White Tiger Cyclone | 22114 | White Tiger Blade Master lumière | Réduction de DEF — coup 1 |
| Wild Bolt | 18127, 18128, 18129 | Vendhan feu, Chakra vent, Dyeus lumière | Marque — chaque coup (en état Thunderer) |
| Wild Shot! | 13306, 13307, 13309 | Abigail eau, Scarlett feu, Emily lumière | Réduction de DEF — chaque coup |
| Will-o'-the-Wisp | 2216, 2217, 2218, 2219, 2220 | Soha eau, Shihwa feu, Arang vent, Chamie lumière, Kamiya ténèbres | Marque — chaque coup |
| Zoltraak・Barrage | 25006, 25008, 25010 | Fern eau, Fern vent, Fern ténèbres | Réduction de DEF — chaque coup |
