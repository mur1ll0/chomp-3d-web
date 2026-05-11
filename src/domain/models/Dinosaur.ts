export class Dinosaur {
  public id: string;
  public position: { x: number, y: number, z: number };
  public species: string;
  public scale: number;

  constructor(id: string, species: string) {
    this.id = id;
    this.species = species;
    this.position = { x: 0, y: 0, z: 0 };
    this.scale = 1.0;
  }
}
